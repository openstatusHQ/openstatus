import { eq } from "@openstatus/db";
import {
  type OAuthClient,
  oauthClient,
  selectOAuthClientSchema,
} from "@openstatus/db/src/schema";
import { assertSafeUrlSync } from "@openstatus/utils";
import { z } from "zod";

import type { DB } from "../context";
import { InternalServiceError } from "../errors";
import { OAuthError } from "./errors";

/**
 * Client ID Metadata Documents: a client identifies itself with an HTTPS URL
 * that serves its own metadata. Domain ownership is the trust anchor, so no
 * registration and no allowlist entry are needed.
 */

export const CIMD_FETCH_TIMEOUT_MS = 5_000;
export const CIMD_MAX_BYTES = 64 * 1024;

// Carrier-grade NAT; the shared helper does not cover it.
const CGNAT_V4 = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;

/**
 * HTTPS, non-root path, public hostname. Layers CIMD rules on the repo's
 * SSRF blocklist. Hostname checks cannot see what DNS resolves to, so a
 * rebound name still reaches `fetch`. That is accepted because the fetch is
 * HTTPS with certificate verification: an internal host cannot present a
 * certificate for the attacker's name, so its response is never read.
 * The residual is a timing oracle on whether an internal port answers.
 */
export function isUrlClientId(clientId: string): boolean {
  if (clientId.includes("#")) return false;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.pathname === "/" || url.username || url.password) return false;

  try {
    assertSafeUrlSync(clientId);
  } catch {
    return false;
  }

  // Trailing dot is the same name to DNS; strip it before suffix checks.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return !CGNAT_V4.test(host);
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa") ||
    !host.includes(".")
  ) {
    return false;
  }
  return true;
}

const redirectUriSchema = z.string().refine((value) => {
  if (value.includes("#")) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    const loopback =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    return url.protocol === "https:" || (loopback && url.protocol === "http:");
  } catch {
    return false;
  }
}, "redirect_uris must be https or loopback, without fragment or credentials");

export const ClientMetadataDocument = z.object({
  client_id: z.string().url(),
  client_name: z.string().trim().min(1).max(120).optional(),
  redirect_uris: z.array(redirectUriSchema).min(1).max(20),
  token_endpoint_auth_method: z.literal("none").optional(),
});
export type ClientMetadataDocument = z.infer<typeof ClientMetadataDocument>;

/** Validates the body and pins `client_id` to the URL it was fetched from. */
export function parseClientMetadataDocument(
  clientId: string,
  body: unknown,
): ClientMetadataDocument {
  const parsed = ClientMetadataDocument.safeParse(body);
  if (!parsed.success) {
    throw new OAuthError(
      "invalid_client",
      `Client metadata document is invalid: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "document"} ${i.message}`)
        .join("; ")}`,
    );
  }
  if (parsed.data.client_id !== clientId) {
    throw new OAuthError(
      "invalid_client",
      "Client metadata document client_id does not match its URL",
    );
  }
  return parsed.data;
}

export type ClientMetadataFetcher = (
  clientId: string,
) => Promise<ClientMetadataDocument>;

/** Reads at most `limit` bytes; an oversized or chunked body is cut off, not buffered. */
async function readBounded(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new OAuthError(
        "invalid_client",
        "Client metadata document is too large",
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Default fetcher: no redirects, bounded time and size, JSON only. */
export async function fetchClientMetadataDocument(
  clientId: string,
): Promise<ClientMetadataDocument> {
  if (!isUrlClientId(clientId)) {
    throw new OAuthError(
      "invalid_client",
      "client_id is not a valid metadata URL",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CIMD_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(clientId, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new OAuthError(
        "invalid_client",
        `Client metadata document responded with HTTP ${res.status}`,
      );
    }
    const text = await readBounded(res, CIMD_MAX_BYTES);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new OAuthError(
        "invalid_client",
        "Client metadata document is not JSON",
      );
    }
    return parseClientMetadataDocument(clientId, body);
  } catch (err) {
    if (err instanceof OAuthError) throw err;
    // The raw error distinguishes refused / bad certificate / timeout, which
    // would let an unauthenticated caller probe internal ports. Log it only.
    console.warn(
      `[oauth/cimd] fetch failed for ${clientId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    throw new OAuthError(
      "invalid_client",
      "Client metadata document could not be fetched",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the document and upsert the client row keyed by its URL. Runs once per
 * authorize request, so no separate cache; a row an operator revoked stays
 * revoked no matter what the document says.
 */
export async function resolveUrlClient(
  db: DB,
  clientId: string,
  fetcher: ClientMetadataFetcher = fetchClientMetadataDocument,
): Promise<OAuthClient> {
  const existing = await db
    .select({ revokedAt: oauthClient.revokedAt })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .get();
  if (existing?.revokedAt) {
    throw new OAuthError("invalid_client", "Unknown or revoked client");
  }

  const doc = await fetcher(clientId);
  const values = {
    name: doc.client_name ?? new URL(clientId).hostname,
    redirectUris: Array.from(new Set(doc.redirect_uris)),
  };
  const [row] = await db
    .insert(oauthClient)
    .values({ clientId, ...values })
    .onConflictDoUpdate({ target: oauthClient.clientId, set: values })
    .returning();
  if (!row) throw new InternalServiceError("Failed to store URL client");
  return selectOAuthClientSchema.parse(row);
}
