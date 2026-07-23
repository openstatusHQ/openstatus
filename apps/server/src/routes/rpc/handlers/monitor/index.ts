import type { ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, gte, isNull, sql } from "@openstatus/db";
import { monitor, monitorRun } from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import type {
  DNSMonitor,
  GetMonitorResponse,
  GetMonitorSummaryResponse,
  HTTPMonitor,
  HTTPResponseLogPagination,
  ListMonitorHTTPResponseLogsResponse,
  MonitorConfig,
  MonitorService,
  RegionStatus,
  TCPMonitor,
} from "@openstatus/proto/monitor/v1";
import { TimeRange } from "@openstatus/proto/monitor/v1";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@openstatus/services";
import {
  type MonitorTimeRange,
  deleteMonitor,
  getMonitorStatus,
  getMonitorSummary,
  getResponseLog,
  listResponseLogs,
} from "@openstatus/services/monitor";

import { env } from "../../../../env";
import {
  getCheckerPayload,
  getCheckerTimeout,
  getCheckerUrl,
} from "../../../../libs/checker";
import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  MONITOR_DEFAULTS,
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
  responseLogNotFoundError,
  responseLogsNotEnabledError,
} from "./errors";
import { checkMonitorLimits } from "./limits";
import {
  toHTTPResponseLogDetail,
  toHTTPResponseLogListItem,
} from "./response-logs";
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
          signal: AbortSignal.timeout(getCheckerTimeout(row)),
        });
      }),
    );

    return { success: true };
  },

  async deleteMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);

    try {
      await deleteMonitor({
        ctx: toServiceCtx(rpcCtx),
        input: { id: Number(req.id) },
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw monitorNotFoundError(req.id);
      }
      toConnectError(err);
    }

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
    try {
      const result = await getMonitorStatus({
        ctx: toServiceCtx(rpcCtx),
        input: { monitorId: Number(req.id) },
      });
      const regions: RegionStatus[] = result.regions.map((s) => ({
        $typeName: "openstatus.monitor.v1.RegionStatus" as const,
        region: stringToRegion(s.region),
        status: stringToMonitorStatus(s.status),
      }));
      return { id: String(result.id), regions };
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw monitorNotFoundError(req.id);
      }
      toConnectError(err);
    }
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
      default:
        throw monitorTypeMismatchError(
          req.id,
          "http, tcp, or dns",
          monitorData.jobType,
        );
    }

    return {
      $typeName: "openstatus.monitor.v1.GetMonitorResponse",
      monitor: monitorConfig,
    } satisfies GetMonitorResponse;
  },

  async getMonitorSummary(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const effectiveTimeRange =
      req.timeRange === TimeRange.TIME_RANGE_UNSPECIFIED
        ? TimeRange.TIME_RANGE_1D
        : req.timeRange;
    const timeRangeKey: MonitorTimeRange = timeRangeToKey(req.timeRange);
    const requestedRegions = regionsToStrings(req.regions);

    try {
      const result = await getMonitorSummary({
        ctx: toServiceCtx(rpcCtx),
        input: {
          monitorId: Number(req.id),
          timeRange: timeRangeKey,
          regions: requestedRegions.length > 0 ? requestedRegions : undefined,
        },
      });
      return {
        $typeName: "openstatus.monitor.v1.GetMonitorSummaryResponse" as const,
        id: req.id,
        lastPingAt: result.lastPingAt,
        totalSuccessful: BigInt(result.totalSuccessful),
        totalDegraded: BigInt(result.totalDegraded),
        totalFailed: BigInt(result.totalFailed),
        p50: BigInt(result.p50),
        p75: BigInt(result.p75),
        p90: BigInt(result.p90),
        p95: BigInt(result.p95),
        p99: BigInt(result.p99),
        timeRange: effectiveTimeRange,
        regions: stringsToRegions(result.regions),
      } satisfies GetMonitorSummaryResponse;
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw monitorNotFoundError(req.id);
      }
      if (err instanceof ValidationError) {
        throw monitorTypeMismatchError(req.id, "http, tcp, or dns", "other");
      }
      toConnectError(err);
    }
  },

  async listMonitorHTTPResponseLogs(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const limit = Math.min(Math.max(req.limit ?? 25, 1), 100);
    const offset = Math.max(req.offset ?? 0, 0);

    try {
      const result = await listResponseLogs({
        ctx: toServiceCtx(rpcCtx),
        input: {
          monitorId: Number(req.id),
          fromTimestamp: req.fromTimestamp
            ? Number(req.fromTimestamp)
            : undefined,
          toTimestamp: req.toTimestamp ? Number(req.toTimestamp) : undefined,
          limit,
          offset,
        },
      });
      const logs = result.logs.map(toHTTPResponseLogListItem);
      const pagination: HTTPResponseLogPagination = {
        $typeName: "openstatus.monitor.v1.HTTPResponseLogPagination",
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
        nextOffset: result.nextOffset,
      };
      return {
        $typeName:
          "openstatus.monitor.v1.ListMonitorHTTPResponseLogsResponse" as const,
        logs,
        pagination,
      } satisfies ListMonitorHTTPResponseLogsResponse;
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw monitorNotFoundError(req.id);
      }
      if (err instanceof ForbiddenError) {
        throw responseLogsNotEnabledError();
      }
      if (err instanceof ValidationError) {
        const jobType =
          (await getMonitorById(Number(req.id), rpcCtx.workspace.id))
            ?.jobType ?? "unknown";
        throw monitorTypeMismatchError(req.id, "http", jobType);
      }
      toConnectError(err);
    }
  },

  async getMonitorHTTPResponseLog(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    try {
      const log = await getResponseLog({
        ctx: toServiceCtx(rpcCtx),
        input: { monitorId: Number(req.id), logId: req.logId },
      });
      return {
        $typeName:
          "openstatus.monitor.v1.GetMonitorHTTPResponseLogResponse" as const,
        log: toHTTPResponseLogDetail(log),
      };
    } catch (err) {
      if (err instanceof NotFoundError) {
        if (err.entity === "response_log") {
          throw responseLogNotFoundError(req.id, req.logId);
        }
        throw monitorNotFoundError(req.id);
      }
      if (err instanceof ForbiddenError) {
        throw responseLogsNotEnabledError();
      }
      if (err instanceof ValidationError) {
        const jobType =
          (await getMonitorById(Number(req.id), rpcCtx.workspace.id))
            ?.jobType ?? "unknown";
        throw monitorTypeMismatchError(req.id, "http", jobType);
      }
      toConnectError(err);
    }
  },
};
