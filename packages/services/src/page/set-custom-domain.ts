import { requireScope } from "../auth";
import { type DB, getReadDb, type ServiceContext } from "../context";
import { LimitExceededError, ValidationError } from "../errors";
import {
  attachDomain,
  attachWwwCompanion,
  detachDomainIfUnused,
  type ProjectDomain,
  resolveVercelConfig,
  type VercelDomainConfig,
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
      const attached = await attachDomain(config, previous).catch((err) => {
        console.warn("Failed to re-attach unchanged domain:", {
          domain: previous,
          error: err,
        });
        return null;
      });
      await syncCompanion(getReadDb(ctx), config, attached);
    }
    return;
  }

  await assertCustomDomainSettable({
    ctx,
    domain: next,
    excludePageId: input.id,
  });

  const attached = next ? await attachDomain(config, next) : null;

  await updatePageCustomDomain({
    ctx,
    input: { id: input.id, customDomain: next },
  });

  await syncCompanion(getReadDb(ctx), config, attached);

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

// Best-effort: the page's own domain is routed, only its www/apex alias is not.
async function syncCompanion(
  db: DB,
  config: VercelDomainConfig | null,
  attached: ProjectDomain | null,
) {
  if (!attached) return;
  await attachWwwCompanion({ db, config, domain: attached }).catch((err) =>
    console.warn("Failed to sync www companion:", {
      domain: attached.name,
      error: err,
    }),
  );
}
