import { z } from "zod";

import { TRPCError } from "@trpc/server";
import { env } from "../env";
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
  misconfigured: z.boolean().default(true).optional(),
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
  | "Domain Not Found"
  | "Unknown Error";

export const domainRouter = createTRPCRouter({
  addDomainToVercel: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(async (opts) => {
      if (opts.input.domain.toLowerCase().includes("openstatus")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Domain cannot contain 'openstatus'",
        });
      }

      const data = await fetch(
        `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains?teamId=${env.TEAM_ID_VERCEL}`,
        {
          body: `{\n  "name": "${opts.input.domain}"\n}`,
          headers: {
            Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const json = await data.json();
      console.log({ json });
      return domainResponseSchema.parse(json);
    }),
  removeDomainFromVercelProject: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(async (opts) => {
      const data = await fetch(
        `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${opts.input.domain}?teamId=${env.TEAM_ID_VERCEL}`,
        {
          headers: {
            Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
          },
          method: "DELETE",
        },
      );
      return await data.json();
    }),
  // removeDomainFromVercelTeam: protectedProcedure
  //   .input(z.object({ domain: z.string() }))
  //   .mutation(async (opts) => {
  //     const data = await fetch(
  //       `https://api.vercel.com/v6/domains/${opts.input.domain}?teamId=${env.TEAM_ID_VERCEL}`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
  //         },
  //         method: "DELETE",
  //       },
  //     );
  //     return await data.json();
  //   }),
  getDomainResponse: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .query(async (opts) => {
      const data = await fetch(
        `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${opts.input.domain}?teamId=${env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
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
    .input(z.object({ domain: z.string() }))
    .query(async (opts) => {
      const data = await fetch(
        `https://api.vercel.com/v6/domains/${opts.input.domain}/config?teamId=${env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );
      const json = await data.json();
      const result = domainConfigResponseSchema.parse(json);
      return result;
    }),
  verifyDomain: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .query(async (opts) => {
      const data = await fetch(
        `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${opts.input.domain}/verify?teamId=${env.TEAM_ID_VERCEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );
      const json = await data.json();
      const result = domainResponseSchema.parse(json);
      return result;
    }),
});
