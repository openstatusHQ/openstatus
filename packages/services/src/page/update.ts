import { eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError } from "../errors";
import {
  assertAccessTypeAllowed,
  assertSlugAvailable,
  getPageInWorkspace,
} from "./internal";
import {
  UpdatePageAppearanceInput,
  UpdatePageConfigurationInput,
  UpdatePageCustomDomainInput,
  UpdatePageGeneralInput,
  UpdatePageLinksInput,
  UpdatePageLocalesInput,
  UpdatePagePasswordProtectionInput,
} from "./schemas";

export async function updatePageGeneral(args: {
  ctx: ServiceContext;
  input: UpdatePageGeneralInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageGeneralInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    if (input.slug !== existing.slug) {
      await assertSlugAvailable({
        tx,
        slug: input.slug,
        excludePageId: existing.id,
      });
    }

    await tx
      .update(page)
      .set({
        title: input.title,
        slug: input.slug,
        description: input.description ?? "",
        icon: input.icon ?? "",
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_general",
      entityType: "page",
      entityId: existing.id,
      before: existing,
    });
  });
}

/**
 * Only persists the `customDomain` change. External integration (Vercel
 * add/remove) is the caller's responsibility — services don't reach out
 * to third-party APIs. The tRPC / Connect adapter calls the Vercel API
 * around the service call.
 *
 * Returns `{ existingDomain }` so the caller can diff without another
 * read.
 */
export async function updatePageCustomDomain(args: {
  ctx: ServiceContext;
  input: UpdatePageCustomDomainInput;
}): Promise<{ existingDomain: string }> {
  const { ctx } = args;
  const input = UpdatePageCustomDomainInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .update(page)
      .set({ customDomain: input.customDomain, updatedAt: new Date() })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_custom_domain",
      entityType: "page",
      entityId: existing.id,
      metadata: {
        from: existing.customDomain,
        to: input.customDomain,
      },
    });

    return { existingDomain: existing.customDomain };
  });
}

export async function updatePagePasswordProtection(args: {
  ctx: ServiceContext;
  input: UpdatePagePasswordProtectionInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePagePasswordProtectionInput.parse(args.input);

  assertAccessTypeAllowed(ctx.workspace, {
    accessType: input.accessType,
    allowedIpRanges: input.allowedIpRanges ?? null,
    allowIndex: input.allowIndex,
  });

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .update(page)
      .set({
        accessType: input.accessType,
        // `?? null` on both array columns so a null/undefined input clears
        // the DB value (e.g. when switching access type) — without it,
        // drizzle sees `undefined` and skips the column, leaving stale
        // authEmailDomains / allowedIpRanges behind.
        authEmailDomains: input.authEmailDomains?.join(",") ?? null,
        password: input.password,
        allowedIpRanges: input.allowedIpRanges?.join(",") ?? null,
        ...(input.allowIndex !== undefined && { allowIndex: input.allowIndex }),
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_password_protection",
      entityType: "page",
      entityId: existing.id,
      metadata: { accessType: input.accessType },
    });
  });
}

export async function updatePageAppearance(args: {
  ctx: ServiceContext;
  input: UpdatePageAppearanceInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageAppearanceInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const currentConfiguration =
      typeof existing.configuration === "object" &&
      existing.configuration !== null
        ? (existing.configuration as Record<string, unknown>)
        : {};

    await tx
      .update(page)
      .set({
        forceTheme: input.forceTheme,
        configuration: {
          ...currentConfiguration,
          theme: input.configuration.theme,
        },
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_appearance",
      entityType: "page",
      entityId: existing.id,
    });
  });
}

export async function updatePageLinks(args: {
  ctx: ServiceContext;
  input: UpdatePageLinksInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageLinksInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    await tx
      .update(page)
      .set({
        homepageUrl: input.homepageUrl,
        contactUrl: input.contactUrl,
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_links",
      entityType: "page",
      entityId: existing.id,
    });
  });
}

export async function updatePageLocales(args: {
  ctx: ServiceContext;
  input: UpdatePageLocalesInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageLocalesInput.parse(args.input);

  if (!ctx.workspace.limits.i18n) {
    throw new LimitExceededError("i18n", 0);
  }

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .update(page)
      .set({
        defaultLocale: input.defaultLocale,
        locales: input.locales,
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_locales",
      entityType: "page",
      entityId: existing.id,
    });
  });
}

export async function updatePageConfiguration(args: {
  ctx: ServiceContext;
  input: UpdatePageConfigurationInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageConfigurationInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const currentConfiguration =
      typeof existing.configuration === "object" &&
      existing.configuration !== null
        ? (existing.configuration as Record<string, unknown>)
        : {};

    await tx
      .update(page)
      .set({
        configuration: {
          ...currentConfiguration,
          ...input.configuration,
        },
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.update_configuration",
      entityType: "page",
      entityId: existing.id,
    });
  });
}
