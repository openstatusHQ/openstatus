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

    const updated = await tx
      .update(page)
      .set({
        title: input.title,
        slug: input.slug,
        description: input.description ?? "",
        icon: input.icon ?? "",
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
    });
  });
}

export async function updatePageCustomDomain(args: {
  ctx: ServiceContext;
  input: UpdatePageCustomDomainInput;
}): Promise<{ existingDomain: string | null }> {
  const { ctx } = args;
  const input = UpdatePageCustomDomainInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const updated = await tx
      .update(page)
      .set({ customDomain: input.customDomain, updatedAt: new Date() })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
    });

    return { existingDomain: existing.customDomain };
  });
}

/**
 * Update the page's access-type + all the fields scoped to it
 * (password / authEmailDomains / allowedIpRanges / allowIndex).
 *
 * The legacy boolean `passwordProtected` column isn't touched here —
 * it's schema-deprecated and the v1 REST read path derives it from
 * `accessType` via `normalizePasswordProtected` (see
 * `apps/server/src/routes/v1/pages/schema.ts`). Deliberately omitted
 * so we're not writing two sources of truth for the same signal.
 */
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

    const updated = await tx
      .update(page)
      .set({
        accessType: input.accessType,
        // `|| null` (not `??`) on both array columns so three inputs
        // all clear the DB value: `undefined`, `null`, and `[]`. An
        // empty array joins to `""`, which `??` wouldn't coerce — we'd
        // persist the empty string instead of nulling the column,
        // leaving a misleading "present but blank" state. `|| null`
        // treats `""` as falsy and maps it to `null`, while real
        // non-empty joins (e.g. `"a@b.com"` / `"10.0.0.0/24"`) pass
        // through unchanged.
        authEmailDomains: input.authEmailDomains?.join(",") || null,
        password: input.password,
        allowedIpRanges: input.allowedIpRanges?.join(",") || null,
        ...(input.allowIndex !== undefined && { allowIndex: input.allowIndex }),
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
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

    const updated = await tx
      .update(page)
      .set({
        forceTheme: input.forceTheme,
        configuration: {
          ...currentConfiguration,
          theme: input.configuration.theme,
        },
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
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
    const updated = await tx
      .update(page)
      .set({
        homepageUrl: input.homepageUrl,
        contactUrl: input.contactUrl,
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
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

    const updated = await tx
      .update(page)
      .set({
        defaultLocale: input.defaultLocale,
        locales: input.locales,
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
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

    const updated = await tx
      .update(page)
      .set({
        configuration: {
          ...currentConfiguration,
          ...input.configuration,
        },
        updatedAt: new Date(),
      })
      .where(eq(page.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page.update",
      entityType: "page",
      entityId: existing.id,
      before: existing,
      after: updated,
    });
  });
}
