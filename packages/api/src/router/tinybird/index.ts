import { z } from "zod";

import { flyRegions } from "@openstatus/db/src/schema/constants";
import { OSTinybird } from "@openstatus/tinybird";

import { type SQL, and, db, eq, inArray } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { calculatePeriod } from "./utils";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const periods = ["1d", "7d", "14d"] as const;
const types = ["http", "tcp"] as const;
type Period = (typeof periods)[number];
type Type = (typeof types)[number];

// NEW: workspace-level counters helper
function getWorkspace30dProcedure(type: Type) {
  return type === "http" ? tb.httpWorkspace30d : tb.tcpWorkspace30d;
}
// Helper functions to get the right procedure based on period and type
function getListProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      return type === "http" ? tb.httpListDaily : tb.tcpListDaily;
    case "7d":
      return type === "http" ? tb.httpListWeekly : tb.tcpListWeekly;
    case "14d":
      return type === "http" ? tb.httpListBiweekly : tb.tcpListBiweekly;
    default:
      return type === "http" ? tb.httpListDaily : tb.tcpListDaily;
  }
}

function getMetricsProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      return type === "http" ? tb.httpMetricsDaily : tb.tcpMetricsDaily;
    case "7d":
      return type === "http" ? tb.httpMetricsWeekly : tb.tcpMetricsWeekly;
    case "14d":
      return type === "http" ? tb.httpMetricsBiweekly : tb.tcpMetricsBiweekly;
    default:
      return type === "http" ? tb.httpMetricsDaily : tb.tcpMetricsDaily;
  }
}

function getMetricsByRegionProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      return type === "http"
        ? tb.httpMetricsByRegionDaily
        : tb.tcpMetricsByRegionDaily;
    case "7d":
      return type === "http"
        ? tb.httpMetricsByRegionWeekly
        : tb.tcpMetricsByRegionWeekly;
    case "14d":
      return type === "http"
        ? tb.httpMetricsByRegionBiweekly
        : tb.tcpMetricsByRegionBiweekly;
    default:
      return type === "http"
        ? tb.httpMetricsByRegionDaily
        : tb.tcpMetricsByRegionDaily;
  }
}

function getMetricsByIntervalProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      return type === "http"
        ? tb.httpMetricsByIntervalDaily
        : tb.tcpMetricsByIntervalDaily;
    case "7d":
      return type === "http"
        ? tb.httpMetricsByIntervalWeekly
        : tb.tcpMetricsByIntervalWeekly;
    case "14d":
      return type === "http"
        ? tb.httpMetricsByIntervalBiweekly
        : tb.tcpMetricsByIntervalBiweekly;
    default:
      return type === "http"
        ? tb.httpMetricsByIntervalDaily
        : tb.tcpMetricsByIntervalDaily;
  }
}

// FIXME: tb pipes are deprecated, we need new ones
function getMetricsRegionsProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      return type === "http"
        ? tb.httpMetricsRegionsDaily
        : tb.tcpMetricsByIntervalDaily;
    case "7d":
      return type === "http"
        ? tb.httpMetricsRegionsWeekly
        : tb.tcpMetricsByIntervalWeekly;
    case "14d":
      return type === "http"
        ? tb.httpMetricsRegionsBiweekly
        : tb.tcpMetricsByIntervalBiweekly;
    default:
      return type === "http"
        ? tb.httpMetricsRegionsDaily
        : tb.tcpMetricsByIntervalDaily;
  }
}

function getStatusProcedure(period: "7d" | "45d", type: Type) {
  switch (period) {
    case "7d":
      return type === "http" ? tb.httpStatusWeekly : tb.tcpStatusWeekly;
    case "45d":
      return type === "http" ? tb.httpStatus45d : tb.tcpStatus45d;
    default:
      return type === "http" ? tb.httpStatusWeekly : tb.tcpStatusWeekly;
  }
}

function getGetProcedure(period: "14d", type: Type) {
  switch (period) {
    case "14d":
      return type === "http" ? tb.httpGetBiweekly : tb.tcpGetBiweekly;
    default:
      return type === "http" ? tb.httpGetBiweekly : tb.tcpGetBiweekly;
  }
}

function getGlobalMetricsProcedure(type: Type) {
  return type === "http" ? tb.httpGlobalMetricsDaily : tb.tcpGlobalMetricsDaily;
}

function getUptimeProcedure(period: "7d" | "30d", type: Type) {
  switch (period) {
    case "7d":
      return type === "http" ? tb.httpUptimeWeekly : tb.tcpUptimeWeekly;
    case "30d":
      return type === "http" ? tb.httpUptime30d : tb.tcpUptime30d;
    default:
      return type === "http" ? tb.httpUptime30d : tb.httpUptime30d;
  }
}

// TODO: missing pipes for other periods
function getMetricsLatencyProcedure(_period: Period, type: Type) {
  return type === "http" ? tb.httpMetricsLatency1d : tb.tcpMetricsLatency1d;
}

function getTimingPhasesProcedure(type: Type) {
  return type === "http" ? tb.httpTimingPhases14d : null;
}

export const tinybirdRouter = createTRPCRouter({
  // Legacy procedure for backward compatibility
  httpGetMonthly: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      }),
    )
    .query(async (opts) => {
      return await tb.httpGetMonthly(opts.input);
    }),

  // Simplified procedures that handle period/type logic on server
  list: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
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
        _monitor.jobType as "http" | "tcp",
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
        interval: z.number().int().optional(), // in minutes, default 30
        regions: z.enum(flyRegions).array().optional(),
        type: z.enum(types).default("http"),
        period: z.enum(["7d", "30d"]).default("30d"),
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
        interval: z.number().int().default(30), // in days
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
        type: z.enum(types).default("http"),
        regions: z.array(z.enum(flyRegions)).optional(),
        cronTimestamp: z.number().int().optional(),
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

  metricsByRegion: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).default("http"),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
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

      const procedure = getMetricsByRegionProcedure(
        opts.input.period,
        opts.input.type,
      );
      return await procedure(opts.input);
    }),

  metricsByInterval: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).default("http"),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
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

      const procedure = getMetricsByIntervalProcedure(
        opts.input.period,
        opts.input.type,
      );
      return await procedure(opts.input);
    }),

  metricsRegions: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).default("http"),
        // Additional filters
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        cronTimestamp: z.number().int().optional(),
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

  status: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(["7d", "45d"]),
        type: z.enum(types).default("http"),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
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

      const procedure = getStatusProcedure(opts.input.period, opts.input.type);
      return await procedure(opts.input);
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
        period: z.enum(["14d"]).default("14d"),
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
        _monitor.jobType as "http" | "tcp",
      );
      return await procedure(opts.input);
    }),

  globalMetrics: protectedProcedure
    .input(
      z.object({
        monitorIds: z.string().array(),
        type: z.enum(types).default("http"),
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
        regions: z.array(z.enum(flyRegions)).optional(),
        type: z.enum(types).default("http"),
      }),
    )
    .query(async (opts) => {
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
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        type: z.literal("http"),
      }),
    )
    .query(async (opts) => {
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
        type: z.enum(types).default("http"),
      }),
    )
    .query(async (opts) => {
      const procedure = getWorkspace30dProcedure(opts.input.type);
      return await procedure({ workspaceId: String(opts.ctx.workspace.id) });
    }),
});
