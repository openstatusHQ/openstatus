import { env } from "./env";

const SUBSCRIBERS_ADDRESS = "notifications@subscribers.openstatus.dev";
const MAX_DISPLAY_NAME_LENGTH = 60;

/**
 * `From` header for openstatus-branded emails: `EMAIL_FROM` when set, so a
 * self-hosted instance can send from its own verified domain.
 */
export function senderFrom(defaultFrom: string, override = env.EMAIL_FROM) {
  return override?.trim() || defaultFrom;
}

/** `Reply-To` header; dropped under `EMAIL_FROM` so replies reach that sender. */
export function senderReplyTo(
  defaultReplyTo: string,
  override = env.EMAIL_FROM,
) {
  return override?.trim() ? undefined : defaultReplyTo;
}

function senderAddress(from: string) {
  const match = from.match(/<([^<>]+)>\s*$/);
  return (match?.[1] ?? from).trim();
}

/**
 * `From` header for status page emails. The page title is customer input, so
 * drop anything that would break the quoted display name (quotes, angle
 * brackets, backslashes, control chars) or make it look like an address (`@`),
 * and cap the length so it doesn't read as spam in the inbox.
 */
export function statusPageFrom(
  pageTitle: string | null | undefined,
  override = env.EMAIL_FROM,
) {
  const cleaned = (pageTitle ?? "")
    .replace(/["<>\\@\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const name = Array.from(cleaned)
    .slice(0, MAX_DISPLAY_NAME_LENGTH)
    .join("")
    .trim();
  const address = override?.trim()
    ? senderAddress(override)
    : SUBSCRIBERS_ADDRESS;
  return `"${name || "openstatus"}" <${address}>`;
}
