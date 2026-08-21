import type { ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import type {
  DNSMonitor,
  GetMonitorResponse,
  GetMonitorSummaryResponse,
  HTTPMonitor,
  HTTPResponseLogPagination,
  ICMPMonitor,
  ListMonitorHTTPResponseLogsResponse,
  MonitorConfig,
  MonitorService,
  RegionStatus,
  TCPMonitor,
} from "@openstatus/proto/monitor/v1";
import { TimeRange } from "@openstatus/proto/monitor/v1";
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "@openstatus/services";
import {
  type MonitorTimeRange,
  type UpdateMonitorConfigInput,
  createMonitor,
  deleteMonitor,
  getMonitorStatus,
  getMonitorSummary,
  getPrivateLocationIdsByMonitor,
  getResponseLog,
  listResponseLogs,
  triggerMonitorRun,
  updateMonitorConfig,
} from "@openstatus/services/monitor";

import { env } from "../../../../env";
import {
  getCheckerPayload,
  getCheckerTimeout,
  getCheckerUrl,
} from "../../../../libs/checker";
import { toConnectError, toServiceCtx } from "../../adapter";
import { type RpcContext, getRpcContext } from "../../interceptors";
import {
  MONITOR_DEFAULTS,
  dbMonitorToDnsProto,
  dbMonitorToHttpProto,
  dbMonitorToIcmpProto,
  dbMonitorToTcpProto,
  protoDnsAssertionsToService,
  protoHeadersToService,
  protoHttpAssertionsToService,
  httpMethodToString,
  regionsToStrings,
  stringToMonitorStatus,
  stringToRegion,
  stringsToRegions,
  timeRangeToKey,
} from "./converters";
import {
  monitorIdRequiredError,
  monitorInvalidDataError,
  monitorNotFoundError,
  monitorParseFailedError,
  monitorRequiredError,
  monitorTypeMismatchError,
  rateLimitExceededError,
  responseLogNotFoundError,
  responseLogsNotEnabledError,
} from "./errors";
import { checkMonitorConfigLimits, checkMonitorLimits } from "./limits";
import {
  toHTTPResponseLogDetail,
  toHTTPResponseLogListItem,
} from "./response-logs";
import {
  getCommonCreateInput,
  getCommonUpdateInput,
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
  expectedJobType: "http" | "tcp" | "dns" | "icmp",
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

/** Apply a built patch through the service and shape the proto response. */
async function applyUpdate<T>(
  rpcCtx: RpcContext,
  monitorId: number,
  updateValues: Omit<UpdateMonitorConfigInput, "id">,
  converter: (data: ParsedMonitor) => T,
): Promise<{ monitor: T }> {
  try {
    const updated = await updateMonitorConfig({
      ctx: toServiceCtx(rpcCtx),
      input: { ...updateValues, id: monitorId },
    });
    return { monitor: converter(updated) };
  } catch (err) {
    toConnectError(err);
  }
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

    try {
      const created = await createMonitor({
        ctx: toServiceCtx(rpcCtx),
        input: {
          ...getCommonCreateInput(mon),
          jobType: "http",
          url: mon.url,
          method: toValidMethod(httpMethodToString(mon.method)),
          body: mon.body || undefined,
          headers: protoHeadersToService(mon.headers) ?? [],
          assertions: protoHttpAssertionsToService(
            mon.statusCodeAssertions,
            mon.bodyAssertions,
            mon.headerAssertions,
          ),
          followRedirects:
            mon.followRedirects ?? MONITOR_DEFAULTS.followRedirects,
        },
      });

      return { monitor: dbMonitorToHttpProto(created) };
    } catch (err) {
      toConnectError(err);
    }
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

    try {
      const created = await createMonitor({
        ctx: toServiceCtx(rpcCtx),
        input: {
          ...getCommonCreateInput(mon),
          jobType: "tcp",
          url: mon.uri,
          method: "GET",
          headers: [],
          assertions: [],
        },
      });

      return { monitor: dbMonitorToTcpProto(created) };
    } catch (err) {
      toConnectError(err);
    }
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

    try {
      const created = await createMonitor({
        ctx: toServiceCtx(rpcCtx),
        input: {
          ...getCommonCreateInput(mon),
          jobType: "dns",
          url: mon.uri,
          method: "GET",
          headers: [],
          assertions: protoDnsAssertionsToService(mon.recordAssertions),
        },
      });

      return { monitor: dbMonitorToDnsProto(created) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async createICMPMonitor(req, ctx) {
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

    try {
      const created = await createMonitor({
        ctx: toServiceCtx(rpcCtx),
        input: {
          ...getCommonCreateInput(mon),
          jobType: "icmp",
          url: mon.uri,
          method: "GET",
          headers: [],
          assertions: [],
        },
      });

      return { monitor: dbMonitorToIcmpProto(created) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updateHTTPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "http");

    const plMap = await getPrivateLocationIdsByMonitor({
      ctx: toServiceCtx(rpcCtx),
      input: { monitorIds: [dbMon.id] },
    });
    const privateLocationIds = plMap.get(dbMon.id) ?? [];

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return {
        monitor: dbMonitorToHttpProto(parsed.data, privateLocationIds),
      };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    checkMonitorConfigLimits(
      limits,
      mon.periodicity || undefined,
      mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
    );

    // Build update values - only include fields that are provided
    const updateValues = getCommonUpdateInput(mon);

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
      updateValues.headers = protoHeadersToService(mon.headers);
    }

    // Repeated proto fields have no presence — they arrive as `[]` whether
    // the caller omitted them or sent none. An empty result must therefore
    // stay `undefined` (leave stored assertions alone) rather than clear it.
    const assertions = protoHttpAssertionsToService(
      mon.statusCodeAssertions ?? [],
      mon.bodyAssertions ?? [],
      mon.headerAssertions ?? [],
    );
    if (assertions.length > 0) {
      updateValues.assertions = assertions;
    }

    return applyUpdate(rpcCtx, dbMon.id, updateValues, (data) =>
      dbMonitorToHttpProto(data, privateLocationIds),
    );
  },

  async updateTCPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "tcp");

    const plMap = await getPrivateLocationIdsByMonitor({
      ctx: toServiceCtx(rpcCtx),
      input: { monitorIds: [dbMon.id] },
    });
    const privateLocationIds = plMap.get(dbMon.id) ?? [];

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return {
        monitor: dbMonitorToTcpProto(parsed.data, privateLocationIds),
      };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    checkMonitorConfigLimits(
      limits,
      mon.periodicity || undefined,
      mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
    );

    // Build update values - only include fields that are provided
    const updateValues = getCommonUpdateInput(mon);

    // Handle TCP-specific fields
    if (mon.uri !== undefined && mon.uri !== "") {
      updateValues.url = mon.uri;
    }

    return applyUpdate(rpcCtx, dbMon.id, updateValues, (data) =>
      dbMonitorToTcpProto(data, privateLocationIds),
    );
  },

  async updateDNSMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "dns");

    const plMap = await getPrivateLocationIdsByMonitor({
      ctx: toServiceCtx(rpcCtx),
      input: { monitorIds: [dbMon.id] },
    });
    const privateLocationIds = plMap.get(dbMon.id) ?? [];

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return {
        monitor: dbMonitorToDnsProto(parsed.data, privateLocationIds),
      };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    checkMonitorConfigLimits(
      limits,
      mon.periodicity || undefined,
      mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
    );

    // Build update values - only include fields that are provided
    const updateValues = getCommonUpdateInput(mon);

    // Handle DNS-specific fields
    if (mon.uri !== undefined && mon.uri !== "") {
      updateValues.url = mon.uri;
    }

    // Empty means "not supplied" — see the note in `updateHTTPMonitor`.
    const assertions = protoDnsAssertionsToService(mon.recordAssertions ?? []);
    if (assertions.length > 0) {
      updateValues.assertions = assertions;
    }

    return applyUpdate(rpcCtx, dbMon.id, updateValues, (data) =>
      dbMonitorToDnsProto(data, privateLocationIds),
    );
  },

  async updateICMPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    const dbMon = await validateAndGetMonitor(req.id, workspaceId, "icmp");

    const plMap = await getPrivateLocationIdsByMonitor({
      ctx: toServiceCtx(rpcCtx),
      input: { monitorIds: [dbMon.id] },
    });
    const privateLocationIds = plMap.get(dbMon.id) ?? [];

    // If no monitor data provided, return current monitor
    if (!req.monitor) {
      const parsed = selectMonitorSchema.safeParse(dbMon);
      if (!parsed.success) {
        throw monitorParseFailedError(req.id);
      }
      return {
        monitor: dbMonitorToIcmpProto(parsed.data, privateLocationIds),
      };
    }

    const mon = req.monitor;

    // Validate regions if provided
    validateCommonMonitorFields(mon);

    // Check workspace limits if periodicity or regions are changing
    checkMonitorConfigLimits(
      limits,
      mon.periodicity || undefined,
      mon.regions && mon.regions.length > 0 ? mon.regions : undefined,
    );

    // Build update values - only include fields that are provided
    const updateValues = getCommonUpdateInput(mon);

    // Handle ICMP-specific fields
    if (mon.uri !== undefined && mon.uri !== "") {
      updateValues.url = mon.uri;
    }

    return applyUpdate(rpcCtx, dbMon.id, updateValues, (data) =>
      dbMonitorToIcmpProto(data, privateLocationIds),
    );
  },

  async triggerMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const limits = rpcCtx.workspace.limits;

    // The run is recorded first so a caller without write scope — or one
    // over its quota — is rejected before any probe leaves the network.
    let run: Awaited<ReturnType<typeof triggerMonitorRun>>;
    try {
      run = await triggerMonitorRun({
        ctx: toServiceCtx(rpcCtx),
        input: { id: Number(req.id) },
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw monitorNotFoundError(req.id);
      }
      if (err instanceof ValidationError) {
        throw monitorInvalidDataError(req.id);
      }
      if (err instanceof LimitExceededError) {
        throw rateLimitExceededError(
          limits["synthetic-checks"],
          err.current ?? limits["synthetic-checks"],
        );
      }
      toConnectError(err);
    }

    const row = run.monitor;
    const url = getCheckerUrl(row);
    const timeout = getCheckerTimeout(row);

    // Trigger checks for each region in parallel
    await Promise.all(
      row.regions.map((region) => {
        const status = run.regionStatus.get(region) || "active";
        const payload = getCheckerPayload(row, status);

        return fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "fly-prefer-region": region,
            Authorization: `Basic ${env.CRON_SECRET}`,
          },
          method: "POST",
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeout),
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

    // Parse first so private-location ids can be resolved in one batched query
    const parsedMonitors: ParsedMonitor[] = [];
    for (const m of monitors) {
      const parsed = selectMonitorSchema.safeParse(m);
      if (parsed.success) parsedMonitors.push(parsed.data); // Skip invalid monitors
    }

    const plMap = await getPrivateLocationIdsByMonitor({
      ctx: toServiceCtx(rpcCtx),
      input: { monitorIds: parsedMonitors.map((m) => m.id) },
    });

    // Group monitors by type
    const httpMonitors: HTTPMonitor[] = [];
    const tcpMonitors: TCPMonitor[] = [];
    const dnsMonitors: DNSMonitor[] = [];
    const icmpMonitors: ICMPMonitor[] = [];

    for (const data of parsedMonitors) {
      const privateLocationIds = plMap.get(data.id) ?? [];
      switch (data.jobType) {
        case "http":
          httpMonitors.push(dbMonitorToHttpProto(data, privateLocationIds));
          break;
        case "tcp":
          tcpMonitors.push(dbMonitorToTcpProto(data, privateLocationIds));
          break;
        case "dns":
          dnsMonitors.push(dbMonitorToDnsProto(data, privateLocationIds));
          break;
        case "icmp":
          icmpMonitors.push(dbMonitorToIcmpProto(data, privateLocationIds));
          break;
      }
    }

    return {
      httpMonitors,
      tcpMonitors,
      dnsMonitors,
      icmpMonitors,
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

    const plMap = await getPrivateLocationIdsByMonitor({
      ctx: toServiceCtx(rpcCtx),
      input: { monitorIds: [monitorData.id] },
    });
    const privateLocationIds = plMap.get(monitorData.id) ?? [];

    // Convert to appropriate proto type based on jobType
    let monitorConfig: MonitorConfig;

    switch (monitorData.jobType) {
      case "http":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: {
            case: "http",
            value: dbMonitorToHttpProto(monitorData, privateLocationIds),
          },
        };
        break;
      case "tcp":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: {
            case: "tcp",
            value: dbMonitorToTcpProto(monitorData, privateLocationIds),
          },
        };
        break;
      case "dns":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: {
            case: "dns",
            value: dbMonitorToDnsProto(monitorData, privateLocationIds),
          },
        };
        break;
      case "icmp":
        monitorConfig = {
          $typeName: "openstatus.monitor.v1.MonitorConfig",
          config: {
            case: "icmp",
            value: dbMonitorToIcmpProto(monitorData, privateLocationIds),
          },
        };
        break;
      default:
        throw monitorTypeMismatchError(
          req.id,
          "http, tcp, dns, or icmp",
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
