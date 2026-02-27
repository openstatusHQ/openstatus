import { z } from "zod";

import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { OSTinybird } from "@openstatus/tinybird";

import { type SQL, and, db, eq, inArray } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { calculatePeriod } from "./utils";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const periods = ["1d", "7d", "14d"] as const;
const types = ["http", "tcp", "dns"] as const;
type Period = (typeof periods)[number];
type Type = (typeof types)[number];

// NEW: workspace-level counters helper
export function getWorkspace30dProcedure(type: Type) {
  return type === "http" ? tb.httpWorkspace30d : tb.tcpWorkspace30d;
}
// Helper functions to get the right procedure based on period and type
export function getListProcedure(period: Period, type: Type) {
  console.log({ period, type });
  switch (period) {
    case "1d":
      if (type === "http") return tb.httpListDaily;
      if (type === "tcp") return tb.tcpListDaily;
      if (type === "dns") return tb.dnsListBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "http") return tb.httpListWeekly;
      if (type === "tcp") return tb.tcpListWeekly;
      if (type === "dns") return tb.dnsListBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "14d":
      if (type === "http") return tb.httpListBiweekly;
      if (type === "tcp") return tb.tcpListBiweekly;
      if (type === "dns") return tb.dnsListBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "http") return tb.httpListDaily;
      if (type === "tcp") return tb.tcpListDaily;
      if (type === "dns") return tb.dnsListBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getMetricsProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      if (type === "dns") return tb.dnsMetricsDaily;
      if (type === "http") return tb.httpMetricsDaily;
      if (type === "tcp") return tb.tcpMetricsDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "dns") return tb.dnsMetricsWeekly;
      if (type === "http") return tb.httpMetricsWeekly;
      if (type === "tcp") return tb.tcpMetricsWeekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "14d":
      if (type === "dns") return tb.dnsMetricsBiweekly;
      if (type === "http") return tb.httpMetricsBiweekly;
      if (type === "tcp") return tb.tcpMetricsBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsMetricsDaily;
      if (type === "http") return tb.httpMetricsDaily;
      if (type === "tcp") return tb.tcpMetricsDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

// FIXME: tb pipes are deprecated, we need new ones
export function getMetricsRegionsProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsDaily;
      if (type === "tcp") return tb.tcpMetricsByIntervalDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsWeekly;
      if (type === "tcp") return tb.tcpMetricsByIntervalWeekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "14d":
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsBiweekly;
      if (type === "tcp") return tb.tcpMetricsByIntervalBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsDaily;
      if (type === "tcp") return tb.tcpMetricsByIntervalDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getStatusProcedure(_period: "45d", type: Type) {
  if (type === "dns") return tb.dnsStatus45d;
  if (type === "http") return tb.httpStatus45d;
  if (type === "tcp") return tb.tcpStatus45d;
  throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
}

export function getGetProcedure(period: "14d", type: Type) {
  switch (period) {
    case "14d":
      if (type === "http") return tb.httpGetBiweekly;
      if (type === "tcp") return tb.tcpGetBiweekly;
      if (type === "dns") return tb.dnsGetBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "http") return tb.httpGetBiweekly;
      if (type === "tcp") return tb.tcpGetBiweekly;
      if (type === "dns") return tb.dnsGetBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getGlobalMetricsProcedure(type: Type) {
  return type === "http" ? tb.httpGlobalMetricsDaily : tb.tcpGlobalMetricsDaily;
}

export function getUptimeProcedure(period: "7d" | "30d", type: Type) {
  switch (period) {
    case "7d":
      if (type === "dns") return tb.dnsUptime30d;
      if (type === "http") return tb.httpUptimeWeekly;
      if (type === "tcp") return tb.tcpUptimeWeekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "30d":
      if (type === "dns") return tb.dnsUptime30d;
      if (type === "http") return tb.httpUptime30d;
      if (type === "tcp") return tb.tcpUptime30d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsUptime30d;
      if (type === "http") return tb.httpUptime30d;
      if (type === "tcp") return tb.tcpUptime30d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

// TODO: missing pipes for other periods
export function getMetricsLatencyProcedure(_period: Period, type: Type) {
  switch (_period) {
    case "1d":
      if (type === "dns") return tb.dnsMetricsLatency7d;
      if (type === "http") return tb.httpMetricsLatency1d;
      if (type === "tcp") return tb.tcpMetricsLatency1d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "dns") return tb.dnsMetricsLatency7d;
      if (type === "http") return tb.httpMetricsLatency7d;
      if (type === "tcp") return tb.tcpMetricsLatency7d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsMetricsLatency7d;
      if (type === "http") return tb.httpMetricsLatency1d;
      if (type === "tcp") return tb.tcpMetricsLatency1d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getMetricsLatencyMultiProcedure(_period: Period, type: Type) {
  if (type === "dns") return tb.dnsMetricsLatency1dMulti;
  if (type === "http") return tb.httpMetricsLatency1dMulti;
  if (type === "tcp") return tb.tcpMetricsLatency1dMulti;
  throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
}

export function getTimingPhasesProcedure(type: Type) {
  return type === "http" ? tb.httpTimingPhases14d : null;
}

export const tinybirdRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        region: z.enum(monitorRegions).or(z.string()).optional(),
        cronTimestamp: z.int().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      const period = calculatePeriod(opts.input.from, opts.input.to);

      const procedure = getListProcedure(
        period,
        _monitor.jobType as "http" | "tcp" | "dns",
      );
      return await procedure({
        ...opts.input,
        fromDate: opts.input.from?.getTime() ?? undefined,
        toDate: opts.input.to?.getTime(),
      });
    }),

  uptime: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        interval: z.int().optional(), // in minutes, default 30
        regions: z.enum(monitorRegions).or(z.string()).array().optional(),
        type: z.enum(types).prefault("http"),
        period: z.enum(["7d", "30d"]).prefault("30d"),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      const procedure = getUptimeProcedure(opts.input.period, opts.input.type);
      return await procedure(opts.input);
    }),

  auditLog: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        interval: z.int().prefault(30), // in days
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      return await tb.getAuditLog({
        monitorId: `monitor:${opts.input.monitorId}`,
        interval: opts.input.interval,
      });
    }),

  metrics: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).prefault("http"),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        cronTimestamp: z.int().optional(),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (opts.ctx.workspace.plan === "free") {
        opts.input.regions = undefined;
      }

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      const procedure = getMetricsProcedure(opts.input.period, opts.input.type);
      return await procedure(opts.input);
    }),

  metricsRegions: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).prefault("http"),
        // Additional filters
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        cronTimestamp: z.int().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      if (opts.ctx.workspace.plan === "free") {
        opts.input.regions = undefined;
      }

      const procedure = getMetricsRegionsProcedure(
        opts.input.period,
        opts.input.type,
      );
      return await procedure(opts.input);
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
        period: z.enum(["14d"]).prefault("14d"),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      const procedure = getGetProcedure(
        opts.input.period,
        _monitor.jobType as "http" | "tcp" | "dns",
      );
      return await procedure(opts.input);
    }),

  globalMetrics: protectedProcedure
    .input(
      z.object({
        monitorIds: z.string().array(),
        type: z.enum(types).prefault("http"),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.workspaceId, opts.ctx.workspace.id),
        inArray(monitor.id, opts.input.monitorIds.map(Number)),
      ];

      const _monitors = await db.query.monitor.findMany({
        where: and(...whereConditions),
      });

      if (_monitors.length !== opts.input.monitorIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some monitors not found",
        });
      }

      const procedure = getGlobalMetricsProcedure(opts.input.type);
      return await procedure(opts.input);
    }),

  metricsLatency: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        type: z.enum(types).prefault("http"),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      if (opts.ctx.workspace.plan === "free") {
        opts.input.regions = undefined;
      }

      const procedure = getMetricsLatencyProcedure(
        opts.input.period,
        opts.input.type,
      );
      return await procedure(opts.input);
    }),

  metricsTimingPhases: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        type: z.literal("http"),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, Number.parseInt(opts.input.monitorId)),
        eq(monitor.workspaceId, opts.ctx.workspace.id),
      ];

      const _monitor = await db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!_monitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }

      if (opts.ctx.workspace.plan === "free") {
        opts.input.regions = undefined;
      }

      const procedure = getTimingPhasesProcedure(opts.input.type);

      if (!procedure) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timing phases not supported for this type",
        });
      }

      return await procedure(opts.input);
    }),

  workspace30d: protectedProcedure
    .input(
      z.object({
        type: z.enum(types).prefault("http"),
      }),
    )
    .query(async (opts) => {
      const procedure = getWorkspace30dProcedure(opts.input.type);
      return await procedure({ workspaceId: String(opts.ctx.workspace.id) });
    }),
});
