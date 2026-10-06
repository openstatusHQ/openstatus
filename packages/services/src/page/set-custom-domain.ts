import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { ConflictError, LimitExceededError, ValidationError } from "../errors";
import {
  attachDomain,
  detachDomainIfUnused,
  findDomainHolder,
  resolveVercelConfig,
} from "./domain-sync";
import { getPageCustomDomain } from "./list";
import { UpdatePageCustomDomainInput } from "./schemas";
import { updatePageCustomDomain } from "./update";

/**
 * Set or clear a page's custom domain and keep the Vercel project in sync.
 * Not transactional on purpose: an HTTP round-trip inside a libSQL write
 * transaction blocks every other writer. Attach → detach → write self-heals on
 * retry because both Vercel calls are idempotent.
 */
export async function setPageCustomDomain(args: {
  ctx: ServiceContext;
  input: UpdatePageCustomDomainInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdatePageCustomDomainInput.parse(args.input);
  const next = input.customDomain;

  const previous = await getPageCustomDomain({ ctx, input: { id: input.id } });
  const config = resolveVercelConfig(ctx);
  // Case-only changes count as unchanged: DNS is case-insensitive. Re-attaching
  // (idempotent) lets a re-save heal a row that never reached Vercel.
  if (previous.toLowerCase() === next.toLowerCase()) {
    if (previous) await attachDomain(config, previous);
    return;
  }

  if (next && !ctx.workspace.limits["custom-domain"]) {
    throw new LimitExceededError("custom-domain", 0);
  }
  if (next.toLowerCase().includes("openstatus")) {
    throw new ValidationError("Domain cannot contain 'openstatus'");
  }
  // Attach is idempotent per project, so it can't tell our own page's
  // attachment from another workspace's — the row check has to.
  if (
    next &&
    (await findDomainHolder({
      db: getReadDb(ctx),
      domain: next,
      excludePageId: input.id,
    }))
  ) {
    throw new ConflictError(
      `The domain '${next}' is already in use. Remove it there first or contact support.`,
    );
  }

  if (next) await attachDomain(config, next);
  if (previous) {
    await detachDomainIfUnused({
      db: getReadDb(ctx),
      domain: previous,
      excludePageId: input.id,
      config,
    });
  }

  await updatePageCustomDomain({
    ctx,
    input: { id: input.id, customDomain: next },
  });
}
