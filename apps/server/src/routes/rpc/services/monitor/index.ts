import { env } from "@/env";
import { getCheckerPayload, getCheckerUrl } from "@/libs/checker";
import { tb } from "@/libs/clients";
import type { ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, gte, inArray, isNull, sql } from "@openstatus/db";
import { monitor, monitorRun } from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import type {
  DNSMonitor,
  GetMonitorResponse,
  GetMonitorSummaryResponse,
  HTTPMonitor,
  MonitorConfig,
  MonitorService,
  RegionStatus,
  TCPMonitor,
} from "@openstatus/proto/monitor/v1";
import { TimeRange } from "@openstatus/proto/monitor/v1";

import { getRpcContext } from "../../interceptors";
import {
  MONITOR_DEFAULTS,
  type TimeRangeKey,
  dbMonitorToDnsProto,
  dbMonitorToHttpProto,
  dbMonitorToTcpProto,
  dnsAssertionsToDbJson,
  headersToDbJson,
  httpAssertionsToDbJson,
  httpMethodToString,
  regionsToStrings,
  stringToMonitorStatus,
  stringToRegion,
  stringsToRegions,
  timeRangeToKey,
} from "./converters";
import {
  monitorCreateFailedError,
  monitorIdRequiredError,
  monitorInvalidDataError,
  monitorNotFoundError,
  monitorParseFailedError,
  monitorRequiredError,
  monitorRunCreateFailedError,
  monitorTypeMismatchError,
  monitorUpdateFailedError,
  rateLimitExceededError,
} from "./errors";
import { checkMonitorLimits } from "./limits";
import {
  getCommonDbValues,
  getCommonDbValuesForUpdate,
  toValidMethod,
  validateCommonMonitorFields,
} from "./validators";

/**
 * Helper to get a monitor by ID with workspace scope.
 */
async function getMonitorById(id: number, workspaceId: number) {
  return db
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.id, id),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .get();
}

type DBMonitor = NonNullable<Awaited<ReturnType<typeof getMonitorById>>>;

/**
 * Helper to validate and get a monitor for update operations.
 * Validates ID, fetches the monitor, and verifies the job type.
 */
async function validateAndGetMonitor(
  id: string | undefined,
  workspaceId: number,
  expectedJobType: "http" | "tcp" | "dns",
): Promise<DBMonitor> {
  if (!id || id.trim() === "") {
    throw monitorIdRequiredError();
  }

  const dbMon = await getMonitorById(Number(id), workspaceId);
  if (!dbMon) {
    throw monitorNotFoundError(id);
  }

  if (dbMon.jobType !== expectedJobType) {
    throw monitorTypeMismatchError(id, expectedJobType, dbMon.jobType);
  }

  return dbMon;
}

type ParsedMonitor = ReturnType<typeof selectMonitorSchema.parse>;

/**
 * Helper to perform update and return the updated monitor.
 */
async function performUpdateAndReturn<T>(
  monitorId: number,
  requestId: string,
  updateValues: Record<string, unknown>,
  converter: (data: ParsedMonitor) => T,
): Promise<{ monitor: T }> {
  const updatedMonitor = await db
    .update(monitor)
    .set(updateValues)
    .where(eq(monitor.id, monitorId))
    .returning()
    .get();

  if (!updatedMonitor) {
    throw monitorUpdateFailedError(requestId);
  }

  const parsed = selectMonitorSchema.safeParse(updatedMonitor);
  if (!parsed.success) {
    throw monitorParseFailedError(requestId);
  }

  return { monitor: converter(parsed.data) };
}

/**
 * Monitor service implementation for ConnectRPC.
 */
export const monitorServiceImpl: ServiceImpl<typeof MonitorService> = {
  async createHTTPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    if (!req.monitor) {
      throw monitorRequiredError();
    }

    const mon = req.monitor;

    // Validate required fields (proto validation handles name, url, periodicity)
    validateCommonMonitorFields(mon);

    // Check workspace limits
    await checkMonitorLimits(workspaceId, limits, mon.periodicity, mon.regions);

    // Get common DB values
    const commonValues = getCommonDbValues(mon);

    // Convert headers and assertions to DB format
    const headers = headersToDbJson(mon.headers);
    const assertions = httpAssertionsToDbJson(
      mon.statusCodeAssertions,
      mon.bodyAssertions,
      mon.headerAssertions,
    );

    // Insert into database
    const newMonitor = await db
      .insert(monitor)
      .values({
        workspaceId,
        jobType: "http",
        url: mon.url,
        method: toValidMethod(httpMethodToString(mon.method)),
        body: mon.body || undefined,
        headers,
        assertions,
        followRedirects:
          mon.followRedirects ?? MONITOR_DEFAULTS.followRedirects,
        ...commonValues,
      })
      .returning()
      .get();

    if (!newMonitor) {
      throw monitorCreateFailedError();
    }

    // Parse through schema to transform fields
    const parsed = selectMonitorSchema.safeParse(newMonitor);
    if (!parsed.success) {
      throw monitorParseFailedError();
    }

    return {
      monitor: dbMonitorToHttpProto(parsed.data),
    };
  },

  async createTCPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    if (!req.monitor) {
      throw monitorRequiredError();
    }

    const mon = req.monitor;

    // Validate required fields (proto validation handles name, uri, periodicity)
    validateCommonMonitorFields(mon);

    // Check workspace limits
    await checkMonitorLimits(workspaceId, limits, mon.periodicity, mon.regions);

    // Get common DB values
    const commonValues = getCommonDbValues(mon);

    // Insert into database
    const newMonitor = await db
      .insert(monitor)
      .values({
        workspaceId,
        jobType: "tcp",
        url: mon.uri,
        ...commonValues,
      })
      .returning()
      .get();

    if (!newMonitor) {
      throw monitorCreateFailedError();
    }

    // Parse through schema to transform fields
    const parsed = selectMonitorSchema.safeParse(newMonitor);
    if (!parsed.success) {
      throw monitorParseFailedError();
    }

    return {
      monitor: dbMonitorToTcpProto(parsed.data),
    };
  },

  async createDNSMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    if (!req.monitor) {
      throw monitorRequiredError();
    }

    const mon = req.monitor;

    // Validate required fields (proto validation handles name, uri, periodicity)
    validateCommonMonitorFields(mon);

    // Check workspace limits
    await checkMonitorLimits(workspaceId, limits, mon.periodicity, mon.regions);

    // Get common DB values
    const commonValues = getCommonDbValues(mon);

    // Convert assertions to DB format
    const assertions = dnsAssertionsToDbJson(mon.recordAssertions);

    // Insert into database
    const newMonitor = await db
      .insert(monitor)
      .values({
        workspaceId,
        jobType: "dns",
        url: mon.uri,
        assertions,
        ...commonValues,
      })
      .returning()
      .get();

    if (!newMonitor) {
      throw monitorCreateFailedError();
    }

    // Parse through schema to transform fields
    const parsed = selectMonitorSchema.safeParse(newMonitor);
    if (!parsed.success) {
      throw monitorParseFailedError();
    }

    return {
      monitor: dbMonitorToDnsProto(parsed.data),
    };
  },

  async updateHTTPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "http");

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return { monitor: dbMonitorToHttpProto(parsed.data) };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    if (mon.periodicity || (mon.regions && mon.regions.length > 0)) {
      await checkMonitorLimits(
        workspaceId,
        limits,
        mon.periodicity || undefined,
        mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
      );
    }

    // Build update values - only include fields that are provided
    const updateValues: Record<string, unknown> =
      getCommonDbValuesForUpdate(mon);

    // Handle HTTP-specific fields
    if (mon.url !== undefined && mon.url !== "") {
      updateValues.url = mon.url;
    }

    if (mon.method !== undefined && mon.method !== 0) {
      updateValues.method = toValidMethod(httpMethodToString(mon.method));
    }

    if (mon.body !== undefined) {
      updateValues.body = mon.body || undefined;
    }

    if (mon.followRedirects !== undefined) {
      updateValues.followRedirects = mon.followRedirects;
    }

    if (mon.headers !== undefined) {
      updateValues.headers = headersToDbJson(mon.headers);
    }

    // Handle assertions - update if any assertion type is provided
    if (
      mon.statusCodeAssertions !== undefined ||
      mon.bodyAssertions !== undefined ||
      mon.headerAssertions !== undefined
    ) {
      updateValues.assertions = httpAssertionsToDbJson(
        mon.statusCodeAssertions ?? [],
        mon.bodyAssertions ?? [],
        mon.headerAssertions ?? [],
      );
    }

    return performUpdateAndReturn(
      dbMon.id,
      req.id,
      updateValues,
      dbMonitorToHttpProto,
    );
  },

  async updateTCPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "tcp");

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return { monitor: dbMonitorToTcpProto(parsed.data) };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    if (mon.periodicity || (mon.regions && mon.regions.length > 0)) {
      await checkMonitorLimits(
        workspaceId,
        limits,
        mon.periodicity || undefined,
        mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
      );
    }

    // Build update values - only include fields that are provided
    const updateValues: Record<string, unknown> =
      getCommonDbValuesForUpdate(mon);

    // Handle TCP-specific fields
    if (mon.uri !== undefined && mon.uri !== "") {
      updateValues.url = mon.uri;
    }

    return performUpdateAndReturn(
      dbMon.id,
      req.id,
      updateValues,
      dbMonitorToTcpProto,
    );
  },

  async updateDNSMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "dns");

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return { monitor: dbMonitorToDnsProto(parsed.data) };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    if (mon.periodicity || (mon.regions && mon.regions.length > 0)) {
      await checkMonitorLimits(
        workspaceId,
        limits,
        mon.periodicity || undefined,
        mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
      );
    }

    // Build update values - only include fields that are provided
    const updateValues: Record<string, unknown> =
      getCommonDbValuesForUpdate(mon);

    // Handle DNS-specific fields
    if (mon.uri !== undefined && mon.uri !== "") {
      updateValues.url = mon.uri;
    }

    // Handle DNS assertions
    if (mon.recordAssertions !== undefined) {
      updateValues.assertions = dnsAssertionsToDbJson(mon.recordAssertions);
    }

    return performUpdateAndReturn(
      dbMon.id,
      req.id,
      updateValues,
      dbMonitorToDnsProto,
    );
  },

  async triggerMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    // Check rate limits
    const lastMonth = new Date().setMonth(new Date().getMonth() - 1);
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(monitorRun)
      .where(
        and(
          eq(monitorRun.workspaceId, workspaceId),
          gte(monitorRun.createdAt, new Date(lastMonth)),
        ),
      )
      .get();

    const count = countResult?.count ?? 0;
    if (count >= limits["synthetic-checks"]) {
      throw rateLimitExceededError(limits["synthetic-checks"], count);
    }

    // Get the monitor
    const dbMon = await getMonitorById(Number(req.id), workspaceId);
    if (!dbMon) {
      throw monitorNotFoundError(req.id);
    }

    // Validate monitor data
    const validateMonitor = selectMonitorSchema.safeParse(dbMon);
    if (!validateMonitor.success) {
      throw monitorInvalidDataError(req.id);
    }

    const row = validateMonitor.data;

    // Get monitor status for each region
    const monitorStatuses = await db
      .select()
      .from(monitorStatusTable)
      .where(eq(monitorStatusTable.monitorId, dbMon.id))
      .all();

    // Create a monitor run record
    const timestamp = Date.now();
    const newRun = await db
      .insert(monitorRun)
      .values({
        monitorId: row.id,
        workspaceId: row.workspaceId,
        runnedAt: new Date(timestamp),
      })
      .returning()
      .get();

    if (!newRun) {
      throw monitorRunCreateFailedError(req.id);
    }

    // Trigger checks for each region in parallel
    await Promise.all(
      validateMonitor.data.regions.map((region) => {
        const statusEntry = monitorStatuses.find((m) => region === m.region);
        const status = statusEntry?.status || "active";
        const payload = getCheckerPayload(row, status);
        const url = getCheckerUrl(row);

        return fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "fly-prefer-region": region,
            Authorization: `Basic ${env.CRON_SECRET}`,
          },
          method: "POST",
          body: JSON.stringify(payload),
        });
      }),
    );

    return { success: true };
  },

  async deleteMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const dbMon = await getMonitorById(Number(req.id), workspaceId);

    if (!dbMon) {
      throw monitorNotFoundError(req.id);
    }

    // Soft delete
    await db
      .update(monitor)
      .set({
        active: false,
        deletedAt: new Date(),
      })
      .where(eq(monitor.id, dbMon.id));

    return { success: true };
  },

  async listMonitors(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
    const offset = req.offset ?? 0;

    // Build query conditions
    const conditions = [
      eq(monitor.workspaceId, workspaceId),
      isNull(monitor.deletedAt),
    ];

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(monitor)
      .where(and(...conditions))
      .get();

    const totalCount = countResult?.count ?? 0;

    // Get monitors
    const monitors = await db
      .select()
      .from(monitor)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .all();

    // Group monitors by type
    const httpMonitors: HTTPMonitor[] = [];
    const tcpMonitors: TCPMonitor[] = [];
    const dnsMonitors: DNSMonitor[] = [];

    for (const m of monitors) {
      // Parse through schema to transform fields
      const parsed = selectMonitorSchema.safeParse(m);
      if (!parsed.success) {
        continue; // Skip invalid monitors
      }

      switch (parsed.data.jobType) {
        case "http":
          httpMonitors.push(dbMonitorToHttpProto(parsed.data));
          break;
        case "tcp":
          tcpMonitors.push(dbMonitorToTcpProto(parsed.data));
          break;
        case "dns":
          dnsMonitors.push(dbMonitorToDnsProto(parsed.data));
          break;
      }
    }

    return {
      httpMonitors,
      tcpMonitors,
      dnsMonitors,
      totalSize: totalCount,
    };
  },

  async getMonitorStatus(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Get the monitor
    const dbMon = await getMonitorById(Number(req.id), workspaceId);
    if (!dbMon) {
      throw monitorNotFoundError(req.id);
    }

    // Parse monitor to get configured regions
    const parsed = selectMonitorSchema.safeParse(dbMon);
    if (!parsed.success) {
      throw monitorParseFailedError(req.id);
    }

    // Get monitor status only for configured regions
    const monitorStatuses = await db
      .select()
      .from(monitorStatusTable)
      .where(
        and(
          eq(monitorStatusTable.monitorId, dbMon.id),
          inArray(monitorStatusTable.region, parsed.data.regions),
        ),
      )
      .all();

    // Map to proto format
    const regions: RegionStatus[] = monitorStatuses.map((s) => ({
      $typeName: "openstatus.monitor.v1.RegionStatus" as const,
      region: stringToRegion(s.region),
      status: stringToMonitorStatus(s.status),
    }));

    return {
      id: String(dbMon.id),
      regions,
    };
  },

  async getMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Get the monitor
    const dbMon = await getMonitorById(Number(req.id), workspaceId);
    if (!dbMon) {
      throw monitorNotFoundError(req.id);
    }

    // Parse monitor data
    const parsed = selectMonitorSchema.safeParse(dbMon);
    if (!parsed.success) {
      throw monitorParseFailedError(req.id);
    }

    const monitorData = parsed.data;

    // Convert to appropriate proto type based on jobType
    let monitorConfig: MonitorConfig;

    switch (monitorData.jobType) {
      case "http":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: { case: "http", value: dbMonitorToHttpProto(monitorData) },
        };
        break;
      case "tcp":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: { case: "tcp", value: dbMonitorToTcpProto(monitorData) },
        };
        break;
      case "dns":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: { case: "dns", value: dbMonitorToDnsProto(monitorData) },
        };
        break;
      default: {
        const _exhaustive: never = monitorData.jobType;
        throw monitorTypeMismatchError(
          req.id,
          "http, tcp, or dns",
          monitorData.jobType,
        );
      }
    }

    return {
      $typeName: "openstatus.monitor.v1.GetMonitorResponse",
      monitor: monitorConfig,
    } satisfies GetMonitorResponse;
  },

  async getMonitorSummary(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Get the monitor
    const dbMon = await getMonitorById(Number(req.id), workspaceId);
    if (!dbMon) {
      throw monitorNotFoundError(req.id);
    }

    // Parse monitor data
    const parsed = selectMonitorSchema.safeParse(dbMon);
    if (!parsed.success) {
      throw monitorParseFailedError(req.id);
    }

    const monitorData = parsed.data;
    const timeRangeKey = timeRangeToKey(req.timeRange);
    const effectiveTimeRange =
      req.timeRange === TimeRange.TIME_RANGE_UNSPECIFIED
        ? TimeRange.TIME_RANGE_1D
        : req.timeRange;

    // Get regions to filter by (use request regions or monitor's configured regions)
    const regionStrings =
      req.regions.length > 0
        ? regionsToStrings(req.regions)
        : monitorData.regions;

    // Build Tinybird query parameters
    const queryParams = {
      monitorId: req.id,
      regions: regionStrings.length > 0 ? regionStrings : undefined,
    };

    // Call appropriate Tinybird method based on monitor type and time range
    const metricsResult = await getMetricsByTypeAndRange(
      monitorData.jobType,
      timeRangeKey,
      queryParams,
    );

    if (!metricsResult || metricsResult.data.length === 0) {
      // Return empty response if no data
      return {
        $typeName: "openstatus.monitor.v1.GetMonitorSummaryResponse" as const,
        id: req.id,
        lastPingAt: "",
        totalSuccessful: BigInt(0),
        totalDegraded: BigInt(0),
        totalFailed: BigInt(0),
        p50: BigInt(0),
        p75: BigInt(0),
        p90: BigInt(0),
        p95: BigInt(0),
        p99: BigInt(0),
        timeRange: effectiveTimeRange,
        regions: stringsToRegions(regionStrings),
      } satisfies GetMonitorSummaryResponse;
    }

    const metrics = metricsResult.data[0];

    // Format last timestamp to RFC 3339
    const lastPingAt = metrics.lastTimestamp
      ? new Date(metrics.lastTimestamp).toISOString()
      : "";

    return {
      $typeName: "openstatus.monitor.v1.GetMonitorSummaryResponse" as const,
      id: req.id,
      lastPingAt,
      totalSuccessful: BigInt(metrics.success ?? 0),
      totalDegraded: BigInt(metrics.degraded ?? 0),
      totalFailed: BigInt(metrics.error ?? 0),
      p50: BigInt(Math.round(metrics.p50Latency ?? 0)),
      p75: BigInt(Math.round(metrics.p75Latency ?? 0)),
      p90: BigInt(Math.round(metrics.p90Latency ?? 0)),
      p95: BigInt(Math.round(metrics.p95Latency ?? 0)),
      p99: BigInt(Math.round(metrics.p99Latency ?? 0)),
      timeRange: effectiveTimeRange,
      regions: stringsToRegions(regionStrings),
    } satisfies GetMonitorSummaryResponse;
  },
};

/**
 * Get metrics from Tinybird based on monitor type and time range.
 */
async function getMetricsByTypeAndRange(
  jobType: string,
  timeRange: TimeRangeKey,
  params: { monitorId: string; regions?: string[] },
) {
  switch (jobType) {
    case "http":
      switch (timeRange) {
        case "1d":
          return tb.httpMetricsDaily(params);
        case "7d":
          return tb.httpMetricsWeekly(params);
        case "14d":
          return tb.httpMetricsBiweekly(params);
      }
      break;
    case "tcp":
      switch (timeRange) {
        case "1d":
          return tb.tcpMetricsDaily(params);
        case "7d":
          return tb.tcpMetricsWeekly(params);
        case "14d":
          return tb.tcpMetricsBiweekly(params);
      }
      break;
    case "dns":
      switch (timeRange) {
        case "1d":
          return tb.dnsMetricsDaily(params);
        case "7d":
          return tb.dnsMetricsWeekly(params);
        case "14d":
          return tb.dnsMetricsBiweekly(params);
      }
      break;
  }
  return null;
}
