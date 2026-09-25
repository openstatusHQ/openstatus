import { customDomainSchema } from "@openstatus/db/src/schema/pages/validation";
import { assertCustomDomainInWorkspace } from "@openstatus/services/page";
import { z } from "zod";

import { env } from "../env";
import { hasTrustedCertificate } from "../lib/tls";
import { issueCertificateOnVercel, vercelFetch } from "../lib/vercel";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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

export const domainResponseSchema = z.object({
  name: z.string().optional(),
  apexName: z.string().optional(),
  projectId: z.string().optional(),
  redirect: z.string().optional().nullable(),
  redirectStatusCode: z
    .union([z.literal(307), z.literal(301), z.literal(302), z.literal(308)])
    .optional()
    .nullable(),
  gitBranch: z.string().optional().nullable(),
  updatedAt: z.number().optional(),
  createdAt: z.number().optional(),
  verified: z.boolean().optional(),
  verification: z
    .array(
      z.object({
        type: z.string(),
        domain: z.string(),
        value: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
});

export type DomainVerificationResponse = z.infer<typeof domainResponseSchema>;
export type DomainConfigResponse = z.infer<typeof domainConfigResponseSchema>;
export type DomainResponse = z.infer<typeof domainResponseSchema>;
export type DomainVerificationStatusProps =
  | "Valid Configuration"
  | "Invalid Configuration"
  | "Pending Verification"
  | "Generating SSL Certificate"
  | "Domain Not Found"
  | "Unknown Error";

async function assertOwned(
  ctx: Parameters<typeof toServiceCtx>[0],
  domain: string,
) {
  try {
    await assertCustomDomainInWorkspace({
      ctx: toServiceCtx(ctx),
      input: { domain },
    });
  } catch (err) {
    toTRPCError(err);
  }
}

const domainInput = z.object({ domain: customDomainSchema.optional() });

async function fetchDomainConfig(domain: string) {
  const data = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config?teamId=${env.TEAM_ID_VERCEL}`,
  );
  const json = await data.json();
  return domainConfigResponseSchema.parse(json);
}

// Only probe hosts Vercel confirms point at us, so the TLS handshake never
// targets an arbitrary customer-controlled address.
async function getCertificateReadiness(domain: string) {
  const config = await fetchDomainConfig(domain);
  if (config.misconfigured !== false)
    return { configured: false, ready: false };
  return { configured: true, ready: await hasTrustedCertificate(domain) };
}

export const domainRouter = createTRPCRouter({
  getDomainResponse: protectedProcedure
    .input(domainInput)
    .query(async (opts) => {
      if (!opts.input.domain) {
        return null;
      }
      await assertOwned(opts.ctx, opts.input.domain);
      const data = await vercelFetch(
        `/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${encodeURIComponent(opts.input.domain)}?teamId=${env.TEAM_ID_VERCEL}`,
      );
      const json = await data.json();
      const result = domainResponseSchema
        .extend({
          error: z
            .object({
              code: z.string(),
              message: z.string(),
            })
            .optional(),
        })
        .parse(json);
      return result;
    }),
  getConfigResponse: protectedProcedure
    .input(domainInput)
    .query(async (opts) => {
      if (!opts.input.domain) {
        return null;
      }
      await assertOwned(opts.ctx, opts.input.domain);
      return fetchDomainConfig(opts.input.domain);
    }),
  getCertificateStatus: protectedProcedure
    .input(domainInput)
    .query(async (opts) => {
      if (!opts.input.domain) {
        return null;
      }
      await assertOwned(opts.ctx, opts.input.domain);
      const { ready } = await getCertificateReadiness(opts.input.domain);
      return { ready };
    }),
  issueCertificate: protectedProcedure
    .input(domainInput)
    .mutation(async (opts) => {
      if (!opts.input.domain) {
        return { issued: false };
      }
      await assertOwned(opts.ctx, opts.input.domain);
      const { configured, ready } = await getCertificateReadiness(
        opts.input.domain,
      );
      if (!configured || ready) {
        return { issued: false };
      }
      await issueCertificateOnVercel(opts.input.domain);
      return { issued: true };
    }),
  verifyDomain: protectedProcedure.input(domainInput).query(async (opts) => {
    if (!opts.input.domain) {
      return null;
    }
    await assertOwned(opts.ctx, opts.input.domain);
    const data = await vercelFetch(
      `/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${encodeURIComponent(opts.input.domain)}/verify?teamId=${env.TEAM_ID_VERCEL}`,
      { method: "POST" },
    );
    const json = await data.json();
    const result = domainResponseSchema.parse(json);
    return result;
  }),
});
