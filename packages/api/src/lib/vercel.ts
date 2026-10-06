import { ServiceError } from "@openstatus/services";
import { vercelFetch as serviceVercelFetch } from "@openstatus/services/page";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "../env";
import { toTRPCError } from "../service-adapter";
import { hasTrustedCertificate } from "./tls";

export async function vercelFetch(path: string, init?: RequestInit) {
  try {
    return await serviceVercelFetch(env.VERCEL_AUTH_BEARER_TOKEN, path, init);
  } catch (err) {
    if (err instanceof ServiceError) toTRPCError(err);
    throw err;
  }
}

export const domainConfigResponseSchema = z.object({
  configuredBy: z
    .union([z.literal("CNAME"), z.literal("A"), z.literal("http")])
    .optional()
    .nullable(),
  acceptedChallenges: z
    .array(z.union([z.literal("dns-01"), z.literal("http-01")]))
    .optional()
    .nullable(),
  misconfigured: z.boolean().prefault(true).optional(),
});

export async function fetchDomainConfig(domain: string) {
  const data = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config?teamId=${env.TEAM_ID_VERCEL}`,
  );
  if (!data.ok) {
    const error = await data.json().catch(() => ({}));
    console.error("Failed to fetch domain config from Vercel:", {
      domain,
      error,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to check the domain configuration. Please try again later.",
    });
  }
  const json = await data.json();
  return domainConfigResponseSchema.parse(json);
}

// Only probe hosts Vercel confirms point at us, so the TLS handshake never
// targets an arbitrary customer-controlled address.
export async function getCertificateReadiness(domain: string) {
  const config = await fetchDomainConfig(domain);
  if (config.misconfigured !== false)
    return { configured: false, ready: false };
  return { configured: true, ready: await hasTrustedCertificate(domain) };
}

// Vercel retries certificate orders on its own backoff, which can leave a
// correctly configured domain on "Generating SSL" for a long time.
export async function issueCertificateOnVercel(domain: string) {
  const response = await vercelFetch(`/v8/certs?teamId=${env.TEAM_ID_VERCEL}`, {
    body: JSON.stringify({ cns: [domain] }),
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Failed to issue certificate on Vercel:", { domain, error });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to issue the SSL certificate. Please try again later. If it continues, contact support.",
    });
  }

  return response.json();
}
