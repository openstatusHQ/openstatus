import { page, pageComponent } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import type { Page } from "../types";
import {
  assertAccessTypeAllowed,
  assertSlugAvailable,
  assertStatusPageQuota,
  validateMonitorIdsActive,
} from "./internal";
import { CreatePageInput, NewPageInput } from "./schemas";

/** Full create — mirrors legacy `pageRouter.create` (insertPageSchema input). */
export async function createPage(args: {
  ctx: ServiceContext;
  input: CreatePageInput;
}): Promise<Page> {
  const { ctx } = args;
  const input = CreatePageInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await assertStatusPageQuota(tx, ctx.workspace);
    await assertSlugAvailable({ tx, slug: input.slug });
    assertAccessTypeAllowed(ctx.workspace, {
      accessType: input.accessType ?? "public",
      passwordProtected: input.passwordProtected ?? null,
      allowedIpRanges: input.allowedIpRanges ?? null,
      allowIndex: input.allowIndex,
    });

    const {
      monitors,
      workspaceId: _ws,
      id: _id,
      configuration,
      ...pageProps
    } = input;
    const monitorIds = monitors?.map((m) => m.monitorId) ?? [];

    const row = await tx
      .insert(page)
      .values({
        workspaceId: ctx.workspace.id,
        configuration: JSON.stringify(configuration),
        ...pageProps,
        authEmailDomains: pageProps.authEmailDomains?.join(","),
        allowedIpRanges: pageProps.allowedIpRanges?.join(","),
      })
      .returning()
      .get();

    if (monitorIds.length > 0) {
      const validMonitors = await validateMonitorIdsActive({
        tx,
        workspaceId: ctx.workspace.id,
        monitorIds,
      });
      const monitorMap = new Map(validMonitors.map((m) => [m.id, m]));
      const pageComponentValues = (monitors ?? [])
        .map(({ monitorId }, index) => {
          const m = monitorMap.get(monitorId);
          if (!m || !m.workspaceId) return null;
          return {
            workspaceId: m.workspaceId,
            pageId: row.id,
            type: "monitor" as const,
            monitorId,
            name: m.externalName || m.name,
            order: index,
            groupId: null,
            groupOrder: 0,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (pageComponentValues.length > 0) {
        await tx.insert(pageComponent).values(pageComponentValues).run();
      }
    }

    await emitAudit(tx, ctx, {
      action: "page.create",
      entityType: "page",
      entityId: row.id,
      after: row,
      metadata: { slug: row.slug },
    });

    return row as unknown as Page;
  });
}

/** Minimal create — matches the dashboard onboarding `new` shape. */
export async function newPage(args: {
  ctx: ServiceContext;
  input: NewPageInput;
}): Promise<Page> {
  const { ctx } = args;
  const input = NewPageInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await assertStatusPageQuota(tx, ctx.workspace);
    await assertSlugAvailable({ tx, slug: input.slug });

    const defaultConfiguration = {
      type: "absolute",
      value: "requests",
      uptime: true,
      theme: "default-rounded",
    };

    const row = await tx
      .insert(page)
      .values({
        workspaceId: ctx.workspace.id,
        title: input.title,
        slug: input.slug,
        description: input.description ?? "",
        icon: input.icon ?? "",
        legacyPage: false,
        configuration: defaultConfiguration,
        customDomain: "",
        allowIndex: true,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.create",
      entityType: "page",
      entityId: row.id,
      after: row,
      metadata: { slug: row.slug, source: "new" },
    });

    return row as unknown as Page;
  });
}

// Re-export to silence "unused" noise in some tsconfigs.
void ConflictError;
