import type { DB } from "../context";
import { resolveSubscriberByToken } from "./internal";
import { GetSubscriberByTokenInput } from "./schemas";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local.length > 0 ? `${local[0]}***` : "***";
  return `${masked}@${domain}`;
}

function maskWebhookUrl(webhookUrl: string): string {
  try {
    return `${new URL(webhookUrl).origin}***`;
  } catch {
    return "<malformed>";
  }
}

export type SubscriberByTokenResult = {
  id: number;
  pageId: number;
  pageName: string;
  pageSlug: string;
  customDomain: string | null;
  channelType: "email" | "webhook";
  email?: string;
  webhookUrl?: string;
  acceptedAt: Date | null;
  unsubscribedAt: Date | null;
  componentIds: number[];
};

/**
 * Public, token-addressed read for the management UI. Email and
 * webhook URL are masked: the token is a low-trust capability and the
 * URL itself can carry credentials in its path (Slack/Discord webhooks).
 * Read-only — no audit emit.
 */
export async function getSubscriberByToken(args: {
  input: GetSubscriberByTokenInput;
  db?: DB;
}): Promise<SubscriberByTokenResult | null> {
  const input = GetSubscriberByTokenInput.parse(args.input);
  const resolved = await resolveSubscriberByToken({
    db: args.db,
    token: input.token,
    domain: input.domain,
  });
  if (!resolved) return null;
  const { row, pageData, components } = resolved;

  return {
    id: row.id,
    pageId: row.pageId,
    pageName: pageData.title,
    pageSlug: pageData.slug,
    customDomain: pageData.customDomain,
    channelType: row.channelType,
    email: row.email ? maskEmail(row.email) : undefined,
    webhookUrl: row.webhookUrl ? maskWebhookUrl(row.webhookUrl) : undefined,
    acceptedAt: row.acceptedAt,
    unsubscribedAt: row.unsubscribedAt,
    componentIds: components,
  };
}
