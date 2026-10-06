import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { LimitExceededError, ValidationError } from "../errors";
import {
  attachDomain,
  detachDomainIfUnused,
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

  if (next && !ctx.workspace.limits["custom-domain"]) {
    throw new LimitExceededError("custom-domain", 0);
  }
  if (next.toLowerCase().includes("openstatus")) {
    throw new ValidationError("Domain cannot contain 'openstatus'");
  }

  const previous = await getPageCustomDomain({ ctx, input: { id: input.id } });
  // Case-only changes skip Vercel too: DNS is case-insensitive.
  if (previous.toLowerCase() === next.toLowerCase()) return;

  const config = resolveVercelConfig(ctx);
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
