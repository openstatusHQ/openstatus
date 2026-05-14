import { monitorStatusSchema } from "@openstatus/db/src/schema";
import { z } from "zod";

import {
  type MonitorTimeRange,
  getMonitor,
  getMonitorStatus,
  getMonitorSummary,
  getResponseLog,
  listMonitors,
  listResponseLogs,
  monitorTimeRange,
} from "../monitor";
import type { AgentTool } from "./types";

const LIST_PER_PAGE_DEFAULT = 25;
const LIST_PER_PAGE_MAX = 50;

const LIST_RESPONSE_LOGS_LIMIT_DEFAULT = 25;
const LIST_RESPONSE_LOGS_LIMIT_MAX = 25;

const ListMonitorsInputShape = z.object({
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("1-indexed page number (default 1)."),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(LIST_PER_PAGE_MAX)
    .default(LIST_PER_PAGE_DEFAULT)
    .describe(
      `Items per page (default ${LIST_PER_PAGE_DEFAULT}, max ${LIST_PER_PAGE_MAX}).`,
    ),
});

const ListMonitorsOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      url: z.string(),
      jobType: z.string(),
      active: z.boolean(),
      periodicity: z.string(),
      regions: z.array(z.string()),
      tags: z.array(z.string()),
      activeIncidentCount: z.number().int(),
    }),
  ),
  pagination: z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    totalSize: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const listMonitorsTool: AgentTool<
  z.infer<typeof ListMonitorsInputShape>,
  z.infer<typeof ListMonitorsOutput>
> = {
  name: "list_monitors",
  description:
    "List monitors in this workspace, newest first. Use to discover the numeric monitorId required by get_monitor, get_monitor_status, get_monitor_summary, list_response_logs. Paginated via `page` (1-indexed) and `perPage`.",
  scope: "read",
  destructive: false,
  inputSchema: ListMonitorsInputShape,
  outputSchema: ListMonitorsOutput,
  async run({ ctx, input }) {
    const { page, perPage } = input;
    const result = await listMonitors({
      ctx,
      input: {
        limit: perPage,
        offset: (page - 1) * perPage,
        order: "desc",
      },
    });
    return {
      items: result.items.map((m) => ({
        id: m.id,
        name: m.name,
        url: m.url,
        jobType: m.jobType,
        active: m.active ?? false,
        periodicity: m.periodicity,
        regions: m.regions,
        tags: m.tags.map((t) => t.name),
        activeIncidentCount: m.incidents.filter((i) => i.resolvedAt === null)
          .length,
      })),
      pagination: {
        page,
        perPage,
        totalSize: result.totalSize,
        totalPages: Math.max(1, Math.ceil(result.totalSize / perPage)),
      },
    };
  },
};

const GetMonitorInputShape = z.object({
  monitorId: z
    .number()
    .int()
    .describe("Monitor id (numeric). Resolve via list_monitors — never guess."),
});

const GetMonitorOutput = z.object({
  id: z.number().int(),
  name: z.string(),
  url: z.string(),
  jobType: z.string(),
  method: z.string().nullable(),
  active: z.boolean(),
  periodicity: z.string(),
  regions: z.array(z.string()),
  timeout: z.number().int(),
  degradedAfter: z.number().int().nullable(),
  retry: z.number().int(),
  followRedirects: z.boolean(),
  public: z.boolean(),
  tags: z.array(z.object({ id: z.number().int(), name: z.string() })),
  notifications: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      provider: z.string(),
    }),
  ),
  privateLocationIds: z.array(z.number().int()),
});

export const getMonitorTool: AgentTool<
  z.infer<typeof GetMonitorInputShape>,
  z.infer<typeof GetMonitorOutput>
> = {
  name: "get_monitor",
  description:
    "Get the full configuration for a single monitor: URL, regions, periodicity, retry/timeout, notification channels, tags. Use after list_monitors when the user asks for detail on a specific monitor. Does NOT return latency or status — use get_monitor_summary or get_monitor_status for that.",
  scope: "read",
  destructive: false,
  inputSchema: GetMonitorInputShape,
  outputSchema: GetMonitorOutput,
  async run({ ctx, input }) {
    const m = await getMonitor({ ctx, input: { id: input.monitorId } });
    return {
      id: m.id,
      name: m.name,
      url: m.url,
      jobType: m.jobType,
      method: m.method ?? null,
      active: m.active ?? false,
      periodicity: m.periodicity,
      regions: m.regions,
      timeout: m.timeout,
      degradedAfter: m.degradedAfter ?? null,
      retry: m.retry,
      followRedirects: m.followRedirects ?? false,
      public: m.public ?? false,
      tags: m.tags.map((t) => ({ id: t.id, name: t.name })),
      notifications: m.notifications.map((n) => ({
        id: n.id,
        name: n.name,
        provider: n.provider,
      })),
      privateLocationIds: m.privateLocations.map((p) => p.id),
    };
  },
};

const GetMonitorStatusInputShape = z.object({
  monitorId: z
    .number()
    .int()
    .describe("Monitor id (numeric). Resolve via list_monitors — never guess."),
});

const GetMonitorStatusOutput = z.object({
  monitorId: z.number().int(),
  regions: z.array(
    z.object({
      region: z.string(),
      status: monitorStatusSchema,
    }),
  ),
});

export const getMonitorStatusTool: AgentTool<
  z.infer<typeof GetMonitorStatusInputShape>,
  z.infer<typeof GetMonitorStatusOutput>
> = {
  name: "get_monitor_status",
  description:
    "Per-region health for a monitor (one row per configured region: active/degraded/error). Report at the worst region's level — DO NOT invent a composite 'overall' label. Use before drafting a status report so the public message reflects the actual blast radius.",
  scope: "read",
  destructive: false,
  inputSchema: GetMonitorStatusInputShape,
  outputSchema: GetMonitorStatusOutput,
  async run({ ctx, input }) {
    const result = await getMonitorStatus({
      ctx,
      input: { monitorId: input.monitorId },
    });
    return {
      monitorId: result.id,
      regions: result.regions.map((r) => ({
        region: r.region,
        status: r.status,
      })),
    };
  },
};

const GetMonitorSummaryInputShape = z.object({
  monitorId: z
    .number()
    .int()
    .describe("Monitor id (numeric). Resolve via list_monitors — never guess."),
  timeRange: z
    .enum(monitorTimeRange)
    .default("1d")
    .describe("Aggregation window: 1d (default), 7d, 14d."),
  regions: z
    .array(z.string())
    .optional()
    .describe(
      "Optional region filter. Defaults to the monitor's currently configured regions.",
    ),
});

const GetMonitorSummaryOutput = z.object({
  monitorId: z.number().int(),
  timeRange: z.enum(monitorTimeRange),
  regions: z.array(z.string()),
  totalSuccessful: z.number().int(),
  totalDegraded: z.number().int(),
  totalFailed: z.number().int(),
  p50: z.number().int(),
  p75: z.number().int(),
  p90: z.number().int(),
  p95: z.number().int(),
  p99: z.number().int(),
  lastPingAt: z.string(),
});

export const getMonitorSummaryTool: AgentTool<
  z.infer<typeof GetMonitorSummaryInputShape>,
  z.infer<typeof GetMonitorSummaryOutput>
> = {
  name: "get_monitor_summary",
  description:
    "Aggregate health metrics for a monitor over a time window: success/degraded/error counts and p50–p99 latency. Default 1h. Pair with get_monitor_status for per-region detail.",
  scope: "read",
  destructive: false,
  inputSchema: GetMonitorSummaryInputShape,
  outputSchema: GetMonitorSummaryOutput,
  async run({ ctx, input }) {
    const result = await getMonitorSummary({
      ctx,
      input: {
        monitorId: input.monitorId,
        timeRange: input.timeRange,
        regions: input.regions,
      },
    });
    return {
      monitorId: result.monitorId,
      timeRange: input.timeRange,
      regions: result.regions,
      totalSuccessful: result.totalSuccessful,
      totalDegraded: result.totalDegraded,
      totalFailed: result.totalFailed,
      p50: result.p50,
      p75: result.p75,
      p90: result.p90,
      p95: result.p95,
      p99: result.p99,
      lastPingAt: result.lastPingAt,
    };
  },
};

const ListResponseLogsInputShape = z.object({
  monitorId: z
    .number()
    .int()
    .describe("Monitor id (numeric). Resolve via list_monitors — never guess."),
  timeRange: z
    .enum(monitorTimeRange)
    .default("1d")
    .describe("Lookback window: 1d (default), 7d, 14d. Anchored at now."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_RESPONSE_LOGS_LIMIT_MAX)
    .default(LIST_RESPONSE_LOGS_LIMIT_DEFAULT)
    .describe(
      `Items per page (default ${LIST_RESPONSE_LOGS_LIMIT_DEFAULT}, max ${LIST_RESPONSE_LOGS_LIMIT_MAX}).`,
    ),
  offset: z.number().int().min(0).default(0),
});

const ResponseLogTimingSchema = z
  .object({
    dns: z.number(),
    connect: z.number(),
    tls: z.number(),
    ttfb: z.number(),
    transfer: z.number(),
  })
  .nullable();

const ResponseLogListItemSchema = z.object({
  id: z.string().nullable(),
  monitorId: z.string(),
  region: z.string(),
  requestStatus: z.enum(["success", "error", "degraded"]).nullable(),
  trigger: z.enum(["cron", "api"]).nullable(),
  statusCode: z.number().int().nullable(),
  latency: z.number(),
  cronTimestamp: z.number(),
  timestamp: z.number(),
  timing: ResponseLogTimingSchema,
});

const ListResponseLogsOutput = z.object({
  logs: z.array(ResponseLogListItemSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
  nextOffset: z.number().int().optional(),
});

export const listResponseLogsTool: AgentTool<
  z.infer<typeof ListResponseLogsInputShape>,
  z.infer<typeof ListResponseLogsOutput>
> = {
  name: "list_response_logs",
  description:
    "Recent HTTP check results for a monitor (per-region, with status code, latency, and request status). Use to diagnose 'what's failing?' over the last 1d (default), 7d, or 14d. HTTP monitors only. Pair with get_response_log for the full detail of a specific check.",
  scope: "read",
  destructive: false,
  inputSchema: ListResponseLogsInputShape,
  outputSchema: ListResponseLogsOutput,
  async run({ ctx, input }) {
    const { from, to } = agentTimeRangeToTimestampWindow(input.timeRange);
    const result = await listResponseLogs({
      ctx,
      input: {
        monitorId: input.monitorId,
        fromTimestamp: from,
        toTimestamp: to,
        limit: input.limit,
        offset: input.offset,
      },
    });
    return {
      logs: result.logs.map((log) => ({
        id: log.id,
        monitorId: log.monitorId,
        region: log.region,
        requestStatus: log.requestStatus,
        trigger: log.trigger,
        statusCode: log.statusCode,
        latency: log.latency,
        cronTimestamp: log.cronTimestamp,
        timestamp: log.timestamp,
        timing: log.timing,
      })),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
    };
  },
};

const GetResponseLogInputShape = z.object({
  monitorId: z
    .number()
    .int()
    .describe("Monitor id (numeric). Resolve via list_monitors — never guess."),
  logId: z
    .string()
    .min(1)
    .describe("Response log id (string). Resolve via list_response_logs."),
});

const GetResponseLogOutput = ResponseLogListItemSchema.extend({
  url: z.string(),
  error: z.boolean(),
  message: z.string().nullable(),
  headers: z.record(z.string(), z.string()),
  assertions: z.string().nullable(),
});

export const getResponseLogTool: AgentTool<
  z.infer<typeof GetResponseLogInputShape>,
  z.infer<typeof GetResponseLogOutput>
> = {
  name: "get_response_log",
  description:
    "Full detail of a single HTTP response log: URL, response headers (sensitive values redacted), error message, assertion results. Use after list_response_logs to drill into one specific failure. Body content is intentionally not exposed.",
  scope: "read",
  destructive: false,
  inputSchema: GetResponseLogInputShape,
  outputSchema: GetResponseLogOutput,
  async run({ ctx, input }) {
    const log = await getResponseLog({
      ctx,
      input: { monitorId: input.monitorId, logId: input.logId },
    });
    return {
      id: log.id,
      monitorId: log.monitorId,
      region: log.region,
      requestStatus: log.requestStatus,
      trigger: log.trigger,
      statusCode: log.statusCode,
      latency: log.latency,
      cronTimestamp: log.cronTimestamp,
      timestamp: log.timestamp,
      timing: log.timing,
      url: log.url,
      error: log.error,
      message: log.message,
      headers: log.headers,
      assertions: log.assertions,
    };
  },
};

function agentTimeRangeToTimestampWindow(value: MonitorTimeRange): {
  from: number;
  to: number;
} {
  const day = 24 * 60 * 60_000;
  const to = Date.now();
  const ms = value === "1d" ? day : value === "7d" ? 7 * day : 14 * day;
  return { from: to - ms, to };
}
