import { getRawWorkOS } from "./client";

export type SsoWebhookEvent =
  | { type: "domain.verified"; organizationId: string; domain: string }
  | { type: "domain.deleted"; organizationId: string; domain: string }
  | { type: "ignored" };

/**
 * Verify a WorkOS webhook signature and narrow it to the two domain events we
 * act on. Returns `ignored` for everything else so callers can 200 and stop
 * WorkOS retrying. Throws when the signature does not verify.
 */
export async function verifyWorkOSWebhook(args: {
  payload: string;
  sigHeader: string;
  secret: string;
}): Promise<SsoWebhookEvent> {
  const event = await getRawWorkOS().webhooks.constructEvent({
    payload: JSON.parse(args.payload),
    sigHeader: args.sigHeader,
    secret: args.secret,
  });

  if (event.event === "organization_domain.verified") {
    return {
      type: "domain.verified",
      organizationId: event.data.organizationId,
      domain: event.data.domain,
    };
  }

  if (event.event === "organization_domain.deleted") {
    return {
      type: "domain.deleted",
      organizationId: event.data.organizationId,
      domain: event.data.domain,
    };
  }

  return { type: "ignored" };
}
