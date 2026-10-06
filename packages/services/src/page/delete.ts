import { eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext, withTransaction } from "../context";
import { detachDomainIfUnused, resolveVercelConfig } from "./domain-sync";
import { getPageInWorkspace } from "./internal";
import { getPageCustomDomain } from "./list";
import { DeletePageInput } from "./schemas";

/**
 * Delete a page. FK cascade clears pageComponents / statusReports / …
 * Detaches the custom domain from Vercel first, so a Vercel failure fails the
 * delete and stays retryable. Callers already inside a transaction pass
 * `releaseDomain: false` and release after commit.
 */
export async function deletePage(args: {
  ctx: ServiceContext;
  input: DeletePageInput;
  releaseDomain?: boolean;
}): Promise<void> {
  const { ctx, releaseDomain = true } = args;
  requireScope(ctx, "write");
  const input = DeletePageInput.parse(args.input);

  if (releaseDomain) {
    const domain = await getPageCustomDomain({ ctx, input: { id: input.id } });
    if (domain) {
      await detachDomainIfUnused({
        db: getReadDb(ctx),
        domain,
        excludePageId: input.id,
        config: resolveVercelConfig(ctx),
      });
    }
  }

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
}
