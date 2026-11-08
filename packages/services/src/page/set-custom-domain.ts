import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { LimitExceededError, ValidationError } from "../errors";
import {
  attachDomain,
  detachDomainIfUnused,
  resolveVercelConfig,
} from "./domain-sync";
import { assertCustomDomainAvailable } from "./internal";
import { getPageCustomDomain } from "./list";
import { UpdatePageCustomDomainInput } from "./schemas";
import { updatePageCustomDomain } from "./update";

/** Every predictable rejection of a new domain, runnable before any write. */
export async function assertCustomDomainSettable(args: {
  ctx: ServiceContext;
  domain: string;
  excludePageId?: number;
}): Promise<void> {
  const { ctx, domain, excludePageId } = args;
  requireScope(ctx, "pages:write");
  if (!domain) return;
  if (!ctx.workspace.limits["custom-domain"]) {
    throw new LimitExceededError("custom-domain", 0);
  }
  if (domain.toLowerCase().includes("openstatus")) {
    throw new ValidationError("Domain cannot contain 'openstatus'");
  }
  // Attach is idempotent per project, so it can't tell our own page's
  // attachment from another workspace's — the row check has to. Not atomic:
  // concurrent claims can both pass without a unique index.
  await assertCustomDomainAvailable({
    tx: getReadDb(ctx),
    customDomain: domain,
    excludePageId,
  });
}

/**
 * Set or clear a page's custom domain and keep the Vercel project in sync.
 * Not transactional: HTTP inside a libSQL write transaction blocks every other
 * writer. Attach → write → detach, so a failure never unroutes the row's domain.
 */
export async function setPageCustomDomain(args: {
  ctx: ServiceContext;
  input: UpdatePageCustomDomainInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "pages:write");
  const input = UpdatePageCustomDomainInput.parse(args.input);
  const next = input.customDomain;

  const previous = await getPageCustomDomain({ ctx, input: { id: input.id } });
  const config = resolveVercelConfig(ctx);
  // Case-only changes count as unchanged: DNS is case-insensitive. Re-attaching
  // (idempotent) lets a re-save heal a row that never reached Vercel; best-effort
  // because nothing changed, so a Vercel outage must not fail the save.
  if (previous.toLowerCase() === next.toLowerCase()) {
    if (previous) {
      await attachDomain(config, previous).catch((err) =>
        console.warn("Failed to re-attach unchanged domain:", {
          domain: previous,
          error: err,
        }),
      );
    }
    return;
  }

  await assertCustomDomainSettable({
    ctx,
    domain: next,
    excludePageId: input.id,
  });

  if (next) await attachDomain(config, next);

  await updatePageCustomDomain({
    ctx,
    input: { id: input.id, customDomain: next },
  });

  if (previous) {
    // The row has moved on: a leftover attachment is an orphan reconcile clears.
    await detachDomainIfUnused({
      db: getReadDb(ctx),
      domain: previous,
      excludePageId: input.id,
      config,
    }).catch((err) =>
      console.warn("Failed to detach previous domain:", {
        domain: previous,
        error: err,
      }),
    );
  }
}
