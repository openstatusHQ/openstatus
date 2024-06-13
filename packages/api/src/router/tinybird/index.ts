import { z } from "zod";

import { flyRegions } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

// WORK IN PROGRESS - we can create a tb router to call it via TRPC server and client

export const tinybirdRouter = createTRPCRouter({
  lastCronTimestamp: protectedProcedure.query(async (opts) => {
    const workspaceId = String(opts.ctx.workspace.id);
    return await tb.endpointLastCronTimestamp("workspace")({ workspaceId });
  }),

  monitorMetricsFromWorkspace: protectedProcedure
    .input(z.object({ period: z.string() }))
    .query(async (opts) => {
      const _workspaceId = String(opts.ctx.workspace.id);
    }),

  responseDetails: protectedProcedure
    .input(
      z.object({
        monitorId: z.string().default("").optional(),
        url: z.string().url().optional(),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      }),
    )
    .query(async (opts) => {
      return await tb.endpointResponseDetails("7d")(opts.input);
    }),

  totalRumMetricsForApplication: protectedProcedure
    .input(z.object({ dsn: z.string(), period: z.enum(["24h", "7d", "30d"]) }))
    .query(async (opts) => {
      return await tb.applicationRUMMetrics()(opts.input);
    }),
  rumMetricsForApplicationPerPage: protectedProcedure
    .input(z.object({ dsn: z.string(), period: z.enum(["24h", "7d", "30d"]) }))
    .query(async (opts) => {
      return await tb.applicationRUMMetricsPerPage()(opts.input);
    }),

  rumMetricsForPath: protectedProcedure
    .input(
      z.object({
        dsn: z.string(),
        path: z.string(),
        period: z.enum(["24h", "7d", "30d"]),
      }),
    )
    .query(async (opts) => {
      return await tb.applicationRUMMetricsForPath()(opts.input);
    }),
  sessionRumMetricsForPath: protectedProcedure
    .input(
      z.object({
        dsn: z.string(),
        path: z.string(),
        period: z.enum(["24h", "7d", "30d"]),
      }),
    )
    .query(async (opts) => {
      return await tb.applicationSessionMetricsPerPath()(opts.input);
    }),
});
