import { type SQL, and, db, eq, inArray } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import {
  getResponseLogFacets,
  listResponseLogsInfinite,
  ResponseLogFilters,
} from "@openstatus/services/monitor";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../../service-adapter";
import { tb } from "../../tb";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const periods = ["1d", "7d", "14d", "30d", "90d"] as const;
const types = ["http", "tcp", "dns", "icmp", "grpc"] as const;
type Period = (typeof periods)[number];
type Type = (typeof types)[number];

// 30d/90d windows are paid-only; free workspaces are blocked server-side.
function assertPaidPeriod(plan: string, period: Period) {
  if (plan === "free" && (period === "30d" || period === "90d")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Upgrade to a paid plan to access 30d and 90d data",
    });
  }
}

// Minimum bucket size (minutes) per period. Floors a client-supplied `interval`
// so long windows can't be forced into pathological point counts (e.g. 5min over
// 90d = ~26k buckets). Short windows keep a low floor so the interval picker still
// works. Only applied when an interval is provided; otherwise the pipe default wins.
const periodToMinInterval: Record<Period, number> = {
  "1d": 5,
  "7d": 5,
  "14d": 5,
  "30d": 240,
  "90d": 1440,
};

function clampInterval(period: Period, interval?: number) {
  if (interval == null) return interval;
  return Math.max(interval, periodToMinInterval[period]);
}

// NEW: workspace-level counters helper
export function getWorkspace30dProcedure(type: Type) {
  if (type === "http") return tb.httpWorkspace30d;
  if (type === "icmp") return tb.icmpWorkspace30d;
  if (type === "grpc") return tb.grpcWorkspace30d;
  return tb.tcpWorkspace30d;
}

export function getMetricsProcedure(period: Period, type: Type) {
  switch (period) {
    case "1d":
      if (type === "dns") return tb.dnsMetricsDaily;
      if (type === "http") return tb.httpMetricsDaily;
      if (type === "tcp") return tb.tcpMetricsDaily;
      if (type === "icmp") return tb.icmpMetricsDaily;
      if (type === "grpc") return tb.grpcMetricsDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "dns") return tb.dnsMetricsWeekly;
      if (type === "http") return tb.httpMetricsWeekly;
      if (type === "tcp") return tb.tcpMetricsWeekly;
      if (type === "icmp") return tb.icmpMetricsWeekly;
      if (type === "grpc") return tb.grpcMetricsWeekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "14d":
      if (type === "dns") return tb.dnsMetricsBiweekly;
      if (type === "http") return tb.httpMetricsBiweekly;
      if (type === "tcp") return tb.tcpMetricsBiweekly;
      if (type === "icmp") return tb.icmpMetricsBiweekly;
      if (type === "grpc") return tb.grpcMetricsBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "30d":
      if (type === "dns") return tb.dnsMetrics30d;
      if (type === "http") return tb.httpMetrics30d;
      if (type === "tcp") return tb.tcpMetrics30d;
      if (type === "icmp") return tb.icmpMetrics30d;
      if (type === "grpc") return tb.grpcMetrics30d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "90d":
      if (type === "dns") return tb.dnsMetrics90d;
      if (type === "http") return tb.httpMetrics90d;
      if (type === "tcp") return tb.tcpMetrics90d;
      if (type === "icmp") return tb.icmpMetrics90d;
      if (type === "grpc") return tb.grpcMetrics90d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsMetricsDaily;
      if (type === "http") return tb.httpMetricsDaily;
      if (type === "tcp") return tb.tcpMetricsDaily;
      if (type === "icmp") return tb.icmpMetricsDaily;
      if (type === "grpc") return tb.grpcMetricsDaily;
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
      if (type === "icmp") return tb.icmpMetricsByIntervalDaily;
      if (type === "grpc") return tb.grpcMetricsByIntervalDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsWeekly;
      if (type === "tcp") return tb.tcpMetricsByIntervalWeekly;
      if (type === "icmp") return tb.icmpMetricsByIntervalWeekly;
      if (type === "grpc") return tb.grpcMetricsByIntervalWeekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "14d":
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsBiweekly;
      if (type === "tcp") return tb.tcpMetricsByIntervalBiweekly;
      if (type === "icmp") return tb.icmpMetricsByIntervalBiweekly;
      if (type === "grpc") return tb.grpcMetricsByIntervalBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "30d":
      if (type === "dns") return tb.dnsMetricsRegions30d;
      if (type === "http") return tb.httpMetricsRegions30d;
      if (type === "tcp") return tb.tcpMetricsByInterval30d;
      if (type === "icmp") return tb.icmpMetricsByInterval30d;
      if (type === "grpc") return tb.grpcMetricsByInterval30d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "90d":
      if (type === "dns") return tb.dnsMetricsRegions90d;
      if (type === "http") return tb.httpMetricsRegions90d;
      if (type === "tcp") return tb.tcpMetricsByInterval90d;
      if (type === "icmp") return tb.icmpMetricsByInterval90d;
      if (type === "grpc") return tb.grpcMetricsByInterval90d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsMetricsRegionsBiweekly;
      if (type === "http") return tb.httpMetricsRegionsDaily;
      if (type === "tcp") return tb.tcpMetricsByIntervalDaily;
      if (type === "icmp") return tb.icmpMetricsByIntervalDaily;
      if (type === "grpc") return tb.grpcMetricsByIntervalDaily;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getStatusProcedure(_period: "45d", type: Type) {
  if (type === "dns") return tb.dnsStatus45d;
  if (type === "http") return tb.httpStatus45d;
  if (type === "tcp") return tb.tcpStatus45d;
  if (type === "icmp") return tb.icmpStatus45d;
  if (type === "grpc") return tb.grpcStatus45d;
  throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
}

export function getGetProcedure(period: "14d", type: Type) {
  switch (period) {
    case "14d":
      if (type === "http") return tb.httpGetBiweekly;
      if (type === "tcp") return tb.tcpGetBiweekly;
      if (type === "dns") return tb.dnsGetBiweekly;
      if (type === "icmp") return tb.icmpGetBiweekly;
      if (type === "grpc") return tb.grpcGetBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "http") return tb.httpGetBiweekly;
      if (type === "tcp") return tb.tcpGetBiweekly;
      if (type === "dns") return tb.dnsGetBiweekly;
      if (type === "icmp") return tb.icmpGetBiweekly;
      if (type === "grpc") return tb.grpcGetBiweekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getGlobalMetricsProcedure(type: Type) {
  if (type === "http") return tb.httpGlobalMetricsDaily;
  if (type === "tcp") return tb.tcpGlobalMetricsDaily;
  if (type === "dns") return tb.dnsGlobalMetricsDaily;
  if (type === "icmp") return tb.icmpGlobalMetricsDaily;
  if (type === "grpc") return tb.grpcGlobalMetricsDaily;
  throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
}

export function getUptimeProcedure(period: "7d" | "30d" | "90d", type: Type) {
  switch (period) {
    case "7d":
      // no 7d DNS uptime pipe; the 30d MV is filtered down by the client window
      if (type === "dns") return tb.dnsUptime30d;
      if (type === "http") return tb.httpUptimeWeekly;
      if (type === "tcp") return tb.tcpUptimeWeekly;
      if (type === "icmp") return tb.icmpUptimeWeekly;
      if (type === "grpc") return tb.grpcUptimeWeekly;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "30d":
      if (type === "dns") return tb.dnsUptime30d;
      if (type === "http") return tb.httpUptime30d;
      if (type === "tcp") return tb.tcpUptime30d;
      if (type === "icmp") return tb.icmpUptime30d;
      if (type === "grpc") return tb.grpcUptime30d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "90d":
      if (type === "dns") return tb.dnsUptime90d;
      if (type === "http") return tb.httpUptime90d;
      if (type === "tcp") return tb.tcpUptime90d;
      if (type === "icmp") return tb.icmpUptime90d;
      if (type === "grpc") return tb.grpcUptime90d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsUptime30d;
      if (type === "http") return tb.httpUptime30d;
      if (type === "tcp") return tb.tcpUptime30d;
      if (type === "icmp") return tb.icmpUptime30d;
      if (type === "grpc") return tb.grpcUptime30d;
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
      if (type === "icmp") return tb.icmpMetricsLatency1d;
      if (type === "grpc") return tb.grpcMetricsLatency1d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "7d":
      if (type === "dns") return tb.dnsMetricsLatency7d;
      if (type === "http") return tb.httpMetricsLatency7d;
      if (type === "tcp") return tb.tcpMetricsLatency7d;
      if (type === "icmp") return tb.icmpMetricsLatency7d;
      if (type === "grpc") return tb.grpcMetricsLatency7d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    // no dedicated 14d latency pipe; 30d MV is the smallest window covering 14d
    case "14d":
    case "30d":
      if (type === "dns") return tb.dnsMetricsLatency30d;
      if (type === "http") return tb.httpMetricsLatency30d;
      if (type === "tcp") return tb.tcpMetricsLatency30d;
      if (type === "icmp") return tb.icmpMetricsLatency30d;
      if (type === "grpc") return tb.grpcMetricsLatency30d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    case "90d":
      if (type === "dns") return tb.dnsMetricsLatency90d;
      if (type === "http") return tb.httpMetricsLatency90d;
      if (type === "tcp") return tb.tcpMetricsLatency90d;
      if (type === "icmp") return tb.icmpMetricsLatency90d;
      if (type === "grpc") return tb.grpcMetricsLatency90d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
    default:
      if (type === "dns") return tb.dnsMetricsLatency7d;
      if (type === "http") return tb.httpMetricsLatency1d;
      if (type === "tcp") return tb.tcpMetricsLatency1d;
      if (type === "icmp") return tb.icmpMetricsLatency1d;
      if (type === "grpc") return tb.grpcMetricsLatency1d;
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
  }
}

export function getMetricsLatencyMultiProcedure(_period: Period, type: Type) {
  if (type === "dns") return tb.dnsMetricsLatency1dMulti;
  if (type === "http") return tb.httpMetricsLatency1dMulti;
  if (type === "tcp") return tb.tcpMetricsLatency1dMulti;
  if (type === "icmp") return tb.icmpMetricsLatency1dMulti;
  if (type === "grpc") return tb.grpcMetricsLatency1dMulti;
  throw new TRPCError({ code: "NOT_FOUND", message: "Invalid type" });
}

export function getTimingPhasesProcedure(period: Period, type: Type) {
  if (type !== "http") return null;
  switch (period) {
    case "30d":
      return tb.httpTimingPhases30d;
    case "90d":
      return tb.httpTimingPhases90d;
    default:
      return tb.httpTimingPhases14d;
  }
}

const listInfiniteInput = ResponseLogFilters.extend({
  monitorId: z.coerce.number().int(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.int().optional(),
  // `@trpc/tanstack-react-query` puts React Query's own paging direction on
  // every infinite-query input, so this field is theirs — the service's
  // `next`/`prev` vocabulary is mapped below.
  direction: z.enum(["forward", "backward"]).optional(),
  limit: z.int().min(1).max(100).prefault(50),
});

const listFacetsInput = ResponseLogFilters.extend({
  monitorId: z.coerce.number().int(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const tinybirdRouter = createTRPCRouter({
  listInfinite: protectedProcedure
    .input(listInfiniteInput)
    .query(async ({ ctx, input }) => {
      try {
        const { from, to, direction, ...rest } = input;
        return await listResponseLogsInfinite({
          ctx: toServiceCtx(ctx),
          input: {
            ...rest,
            fromTimestamp: from?.getTime(),
            toTimestamp: to?.getTime(),
            direction: direction === "backward" ? "prev" : "next",
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  listFacets: protectedProcedure
    .input(listFacetsInput)
    .query(async ({ ctx, input }) => {
      try {
        const { from, to, ...rest } = input;
        return await getResponseLogFacets({
          ctx: toServiceCtx(ctx),
          input: {
            ...rest,
            fromTimestamp: from?.getTime(),
            toTimestamp: to?.getTime(),
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
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
        period: z.enum(["7d", "30d", "90d"]).prefault("30d"),
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

      // only 90d is gated here; 30d is the default uptime MV used by all windows
      if (opts.ctx.workspace.plan === "free" && opts.input.period === "90d") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Upgrade to a paid plan to access 90d data",
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

      assertPaidPeriod(opts.ctx.workspace.plan, opts.input.period);

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

      assertPaidPeriod(opts.ctx.workspace.plan, opts.input.period);

      opts.input.interval = clampInterval(
        opts.input.period,
        opts.input.interval,
      );

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
        _monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc",
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

      assertPaidPeriod(opts.ctx.workspace.plan, opts.input.period);

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

      assertPaidPeriod(opts.ctx.workspace.plan, opts.input.period);

      opts.input.interval = clampInterval(
        opts.input.period,
        opts.input.interval,
      );

      const procedure = getTimingPhasesProcedure(
        opts.input.period,
        opts.input.type,
      );

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
