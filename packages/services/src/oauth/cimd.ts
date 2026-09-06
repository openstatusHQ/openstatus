import { eq } from "@openstatus/db";
import {
  type OAuthClient,
  oauthClient,
  selectOAuthClientSchema,
} from "@openstatus/db/src/schema";
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

const PRIVATE_V4 =
  /^(10\.|127\.|0\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/** HTTPS, non-root path, public hostname. Blocks the SSRF targets a fetch could reach. */
export function isUrlClientId(clientId: string): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.pathname === "/" || url.username || url.password || url.hash) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host.startsWith("[")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return !PRIVATE_V4.test(host);
  }
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
  try {
    const url = new URL(value);
    if (url.hash) return false;
    const host = url.hostname.toLowerCase();
    const loopback =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    return url.protocol === "https:" || (loopback && url.protocol === "http:");
  } catch {
    return false;
  }
}, "redirect_uris must be https or loopback");

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
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > CIMD_MAX_BYTES) {
      throw new OAuthError(
        "invalid_client",
        "Client metadata document is too large",
      );
    }
    const text = await res.text();
    if (text.length > CIMD_MAX_BYTES) {
      throw new OAuthError(
        "invalid_client",
        "Client metadata document is too large",
      );
    }
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
    throw new OAuthError(
      "invalid_client",
      `Client metadata document could not be fetched: ${
        err instanceof Error ? err.message : String(err)
      }`,
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
    .select()
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
