import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";
import { flyRegions } from "@openstatus/db/src/schema/constants";

import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { and, db, eq, inArray, SQL } from "@openstatus/db";
import { TRPCError } from "@trpc/server";
import { monitor } from "@openstatus/db/src/schema";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const periods = ["1d", "7d", "14d"] as const;
const types = ["http", "tcp"] as const;
type Period = (typeof periods)[number];
type Type = (typeof types)[number];

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

function getGetProcedure(period: "30d", type: Type) {
  switch (period) {
    case "30d":
      return type === "http" ? tb.httpGetMonthly : tb.tcpGetMonthly;
    default:
      return type === "http" ? tb.httpGetMonthly : tb.tcpGetMonthly;
  }
}

function getGlobalMetricsProcedure(type: Type) {
  return type === "http" ? tb.httpGlobalMetricsDaily : tb.tcpGlobalMetricsDaily;
}

export const tinybirdRouter = createTRPCRouter({
  // Legacy procedure for backward compatibility
  httpGetMonthly: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      })
    )
    .query(async (opts) => {
      return await tb.httpGetMonthly(opts.input);
    }),

  // Simplified procedures that handle period/type logic on server
  list: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).default("http"),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      })
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

      const procedure = getListProcedure(opts.input.period, opts.input.type);
      return await procedure(opts.input);
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
      })
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

      return await tb.httpUptime30d(opts.input);
    }),

  auditLog: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
      })
    )
    .query(async (opts) => {
      return await tb.getAuditLog({ id: `monitor:${opts.input.monitorId}` });
    }),

  metrics: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        period: z.enum(periods),
        type: z.enum(types).default("http"),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      })
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
      })
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
        opts.input.type
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
      })
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
        opts.input.type
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
      })
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

      const procedure = getMetricsRegionsProcedure(
        opts.input.period,
        opts.input.type
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
      })
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
        monitorId: z.string(),
        period: z.enum(["30d"]),
        type: z.enum(types).default("http"),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      })
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

      const procedure = getGetProcedure(opts.input.period, opts.input.type);
      return await procedure(opts.input);
    }),

  globalMetrics: protectedProcedure
    .input(
      z.object({
        monitorIds: z.string().array(),
        type: z.enum(types).default("http"),
      })
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
});
