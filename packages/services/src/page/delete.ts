import { eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  getReadDb,
  isTx,
  type ServiceContext,
  withTransaction,
} from "../context";
import { detachDomainIfUnused, resolveVercelConfig } from "./domain-sync";
import { getPageInWorkspace } from "./internal";
import { getPageCustomDomain } from "./list";
import { DeletePageInput } from "./schemas";

/**
 * Delete a page. FK cascade clears pageComponents / statusReports / …
 * Releases the custom domain best-effort after the delete; reconcile clears a
 * leak. Inside a caller's transaction it skips Vercel — HTTP must not hold the
 * libSQL writer — and the caller releases after commit.
 */
export async function deletePage(args: {
  ctx: ServiceContext;
  input: DeletePageInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "pages:write");
  const input = DeletePageInput.parse(args.input);

  const domain =
    ctx.db && isTx(ctx.db)
      ? ""
      : await getPageCustomDomain({ ctx, input: { id: input.id } });

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx.delete(page).where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.delete",
      entityType: "page",
      entityId: existing.id,
      before: existing,
    });
  });

  if (domain) {
    await detachDomainIfUnused({
      db: getReadDb(ctx),
      domain,
      excludePageId: input.id,
      config: resolveVercelConfig(ctx),
    }).catch((err) =>
      console.warn("Failed to release domain from Vercel:", {
        domain,
        error: err,
      }),
    );
  }
}
