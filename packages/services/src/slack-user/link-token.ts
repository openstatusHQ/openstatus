import { z } from "zod";

const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
// The server signs and the dashboard verifies, so their clocks can disagree.
const LINK_TOKEN_CLOCK_SKEW_MS = 30 * 1000;

const linkTokenPayload = z.object({
  kind: z.literal("slack-link"),
  workspaceId: z.number().int(),
  teamId: z.string().min(1),
  slackUserId: z.string().min(1),
  ts: z.number(),
});
export type SlackLinkTokenPayload = z.infer<typeof linkTokenPayload>;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSlackLinkToken(
  secret: string,
  input: Omit<SlackLinkTokenPayload, "kind" | "ts">,
  now: number = Date.now(),
): Promise<string> {
  const payload = JSON.stringify({ kind: "slack-link", ...input, ts: now });
  const sig = toBase64Url(await hmac(secret, payload));
  return `${toBase64Url(encoder.encode(payload))}.${sig}`;
}

/** The token's payload, or `null` when it is malformed, forged or expired. */
export async function verifySlackLinkToken(
  secret: string,
  token: string,
  now: number = Date.now(),
): Promise<SlackLinkTokenPayload | null> {
  const [encodedPayload, sig] = token.split(".");
  if (!encodedPayload || !sig) return null;
  try {
    const payload = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const expected = await hmac(secret, payload);
    if (!timingSafeEqual(expected, fromBase64Url(sig))) return null;
    const parsed = linkTokenPayload.safeParse(JSON.parse(payload));
    if (!parsed.success) return null;
    if (
      now - parsed.data.ts > LINK_TOKEN_TTL_MS ||
      parsed.data.ts - now > LINK_TOKEN_CLOCK_SKEW_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
