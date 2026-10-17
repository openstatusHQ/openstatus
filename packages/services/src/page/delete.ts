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
import {
  attachDomain,
  detachDomainIfUnused,
  resolveVercelConfig,
} from "./domain-sync";
import { getPageInWorkspace } from "./internal";
import { getPageCustomDomain } from "./list";
import { DeletePageInput } from "./schemas";

/**
 * Delete a page. FK cascade clears pageComponents / statusReports / …
 * Detaches the custom domain from Vercel first, so a Vercel failure fails the
 * delete and stays retryable. Inside a caller's transaction it skips Vercel —
 * HTTP must not hold the libSQL writer — and the caller releases after commit.
 */
export async function deletePage(args: {
  ctx: ServiceContext;
  input: DeletePageInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DeletePageInput.parse(args.input);

  const config = resolveVercelConfig(ctx);
  let detached: string | null = null;
  if (!ctx.db || !isTx(ctx.db)) {
    const domain = await getPageCustomDomain({ ctx, input: { id: input.id } });
    if (
      domain &&
      (await detachDomainIfUnused({
        db: getReadDb(ctx),
        domain,
        excludePageId: input.id,
        config,
      }))
    ) {
      detached = domain;
    }
  }

  try {
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
  } catch (err) {
    // The page survives, so give its domain back rather than leave it unrouted.
    if (detached) {
      await attachDomain(config, detached).catch((attachErr) =>
        console.warn("Failed to re-attach domain after a failed delete:", {
          domain: detached,
          error: attachErr,
        }),
      );
    }
    throw err;
  }
}
