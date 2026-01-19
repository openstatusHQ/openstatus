import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  HttpAssertionComparator,
  HttpAssertionType,
  HttpMethod,
  type MonitorService,
  MonitorStatus,
  MonitorType,
} from "@openstatus/proto/monitor/v1";

import { getRpcContext } from "../interceptors";

type HttpAssertion = {
  type: HttpAssertionType;
  comparator: HttpAssertionComparator;
  expectedValue: string;
  headerKey?: string;
};

type MonitorConfig =
  | {
      config: {
        case: "http";
        value: {
          url: string;
          method: HttpMethod;
          headers: Record<string, string>;
          body?: string;
          timeoutMs: number;
          followRedirects: boolean;
          assertions: HttpAssertion[];
        };
      };
    }
  | {
      config: {
        case: "tcp";
        value: {
          host: string;
          port: number;
          timeoutMs: number;
        };
      };
    }
  | {
      config: {
        case: "dns";
        value: {
          domain: string;
          recordType: number;
          expectedValues: [] // replace with actual assertion;
          timeoutMs: number;
        };
      };
    };

/**
 * Helper to create a protobuf Timestamp from a Date.
 */
function dateToTimestamp(date: Date) {
  const ms = date.getTime();
  return {
    seconds: BigInt(Math.floor(ms / 1000)),
    nanos: (ms % 1000) * 1_000_000,
  };
}

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

/**
 * Helper to convert database job type to proto MonitorType.
 */
function jobTypeToProtoType(jobType: string): MonitorType {
  switch (jobType) {
    case "http":
      return MonitorType.HTTP;
    case "tcp":
      return MonitorType.TCP;
    case "dns":
      return MonitorType.DNS;
    default:
      return MonitorType.UNSPECIFIED;
  }
}

/**
 * Helper to convert database active status to proto MonitorStatus.
 */
function activeToProtoStatus(active: boolean | null): MonitorStatus {
  return active ? MonitorStatus.ACTIVE : MonitorStatus.PAUSED;
}

/**
 * Helper to convert assertion compare string to proto HttpAssertionComparator.
 */
function compareToProtoComparator(compare: string): HttpAssertionComparator {
  switch (compare) {
    case "eq":
      return HttpAssertionComparator.EQUALS;
    case "not_eq":
      return HttpAssertionComparator.NOT_EQUALS;
    case "contains":
      return HttpAssertionComparator.CONTAINS;
    case "not_contains":
      return HttpAssertionComparator.NOT_CONTAINS;
    case "gt":
      return HttpAssertionComparator.GREATER_THAN;
    case "gte":
        return HttpAssertionComparator.GREATER_THAN_EQUALS
    case "lt":
      return HttpAssertionComparator.LESS_THAN;
    case "lte":
      return HttpAssertionComparator.LESS_THAN_EQUALS;
    default:
      return HttpAssertionComparator.UNSPECIFIED;
  }
}

/**
 * Helper to parse database assertions JSON and convert to proto HttpAssertion array.
 */
function parseDbAssertions(assertionsJson: string | null): HttpAssertion[] {
  if (!assertionsJson) {
    return [];
  }

  try {
    const assertions = JSON.parse(assertionsJson) as Array<{
      type: string;
      compare: string;
      target: string | number;
      key?: string;
      path?: string;
    }>;

    return assertions
      .filter((a) =>
        ["status", "header", "textBody", "jsonBody"].includes(a.type),
      )
      .map((a) => {
        let type: HttpAssertionType;
        let headerKey: string | undefined;

        switch (a.type) {
          case "status":
            type = HttpAssertionType.STATUS_CODE;
            break;
          case "header":
            type = HttpAssertionType.HEADER;
            headerKey = a.key;
            break;
          case "textBody":
          case "jsonBody":
            type = HttpAssertionType.BODY;
            break;
          default:
            type = HttpAssertionType.UNSPECIFIED;
        }

        return {
          type,
          comparator: compareToProtoComparator(a.compare),
          expectedValue: String(a.target),
          headerKey,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Helper to convert database method to proto HttpMethod.
 */
function methodToProtoMethod(method: string | null): HttpMethod {
  switch (method?.toUpperCase()) {
    case "GET":
      return HttpMethod.GET;
    case "POST":
      return HttpMethod.POST;
    case "PUT":
      return HttpMethod.PUT;
    case "PATCH":
      return HttpMethod.PATCH;
    case "DELETE":
      return HttpMethod.DELETE;
    case "HEAD":
      return HttpMethod.HEAD;
    case "OPTIONS":
      return HttpMethod.OPTIONS;
    default:
      return HttpMethod.GET;
  }
}

/**
 * Helper to convert database periodicity string to seconds.
 */
function periodicityToSeconds(periodicity: string): number {
  switch (periodicity) {
    case "30s":
      return 30;
    case "1m":
      return 60;
    case "5m":
      return 300;
    case "10m":
      return 600;
    case "30m":
      return 1800;
    case "1h":
      return 3600;
    default:
      return 60; // Default to 1 minute
  }
}

/**
 * Helper to transform database monitor to proto Monitor.
 */
function dbMonitorToProto(
  dbMon: NonNullable<Awaited<ReturnType<typeof getMonitorById>>>,
) {
  const monitorType = jobTypeToProtoType(dbMon.jobType);

  // Build config based on job type
  let config: MonitorConfig | undefined;
  if (monitorType === MonitorType.HTTP) {
    // Parse headers if present
    let headers: { [key: string]: string } = {};
    if (dbMon.headers) {
      try {
        const parsedHeaders = JSON.parse(dbMon.headers);
        if (Array.isArray(parsedHeaders)) {
          headers = parsedHeaders.reduce(
            (
              acc: { [key: string]: string },
              h: { key: string; value: string },
            ) => {
              acc[h.key] = h.value;
              return acc;
            },
            {},
          );
        }
      } catch {
        // Ignore parse errors
      }
    }

    config = {
      config: {
        case: "http" as const,
        value: {
          url: dbMon.url,
          method: methodToProtoMethod(dbMon.method),
          headers,
          body: dbMon.body ?? undefined,
          timeoutMs: dbMon.timeout,
          followRedirects: dbMon.followRedirects ?? true,
          assertions: parseDbAssertions(dbMon.assertions),
        },
      },
    };
  } else if (monitorType === MonitorType.TCP) {
    // For TCP, URL contains "host:port"
    const [host, portStr] = dbMon.url.split(":");
    config = {
      config: {
        case: "tcp" as const,
        value: {
          host: host || dbMon.url,
          port: portStr ? Number.parseInt(portStr, 10) : 80,
          timeoutMs: dbMon.timeout,
        },
      },
    };
  } else if (monitorType === MonitorType.DNS) {
    config = {
      config: {
        case: "dns" as const,
        value: {
          domain: dbMon.url,
          recordType: 0, // TODO: Map from assertions
          expectedValues: [],
          timeoutMs: dbMon.timeout,
        },
      },
    };
  }

  return {
    id: String(dbMon.id),
    name: dbMon.name,
    description: dbMon.description ?? "",
    type: monitorType,
    config,
    periodicity: periodicityToSeconds(dbMon.periodicity),
    regions: dbMon.regions?.split(",").filter(Boolean) ?? [],
    status: activeToProtoStatus(dbMon.active),
    createdAt: dbMon.createdAt ? dateToTimestamp(dbMon.createdAt) : undefined,
    updatedAt: dbMon.updatedAt ? dateToTimestamp(dbMon.updatedAt) : undefined,
    degradedAfterMs: dbMon.degradedAfter ?? undefined,
    tags: [], // Tags are stored in a separate relation table
  };
}

/**
 * Monitor service implementation for ConnectRPC.
 */
export const monitorServiceImpl: ServiceImpl<typeof MonitorService> = {
  async getMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const dbMon = await getMonitorById(Number(req.id), workspaceId);

    if (!dbMon) {
      throw new ConnectError(`Monitor ${req.id} not found`, Code.NotFound);
    }

    return {
      monitor: dbMonitorToProto(dbMon),
    };
  },

  async listMonitors(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 100);
    const offset = req.pageToken ? Number.parseInt(req.pageToken, 10) : 0;

    // Build query conditions
    const conditions = [
      eq(monitor.workspaceId, workspaceId),
      isNull(monitor.deletedAt),
    ];

    // Apply status filter
    if (
      req.statusFilter !== undefined &&
      req.statusFilter !== MonitorStatus.UNSPECIFIED
    ) {
      const isActive = req.statusFilter === MonitorStatus.ACTIVE;
      conditions.push(eq(monitor.active, isActive));
    }

    // Apply type filter
    if (
      req.typeFilter !== undefined &&
      req.typeFilter !== MonitorType.UNSPECIFIED
    ) {
      const jobType =
        req.typeFilter === MonitorType.HTTP
          ? "http"
          : req.typeFilter === MonitorType.TCP
            ? "tcp"
            : req.typeFilter === MonitorType.DNS
              ? "dns"
              : null;
      if (jobType) {
        conditions.push(eq(monitor.jobType, jobType));
      }
    }

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
      .limit(pageSize)
      .offset(offset)
      .all();

    // Calculate next page token
    const nextOffset = offset + monitors.length;
    const nextPageToken = nextOffset < totalCount ? String(nextOffset) : "";

    return {
      monitors: monitors.map(dbMonitorToProto),
      nextPageToken,
      totalCount,
    };
  },

  async createMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "CreateMonitor not yet implemented",
      Code.Unimplemented,
    );
  },

  async updateMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "UpdateMonitor not yet implemented",
      Code.Unimplemented,
    );
  },

  async deleteMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const dbMon = await getMonitorById(Number(req.id), workspaceId);

    if (!dbMon) {
      throw new ConnectError(`Monitor ${req.id} not found`, Code.NotFound);
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

  async triggerMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "TriggerMonitor not yet implemented",
      Code.Unimplemented,
    );
  },

  async pauseMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const dbMon = await getMonitorById(Number(req.id), workspaceId);

    if (!dbMon) {
      throw new ConnectError(`Monitor ${req.id} not found`, Code.NotFound);
    }

    await db
      .update(monitor)
      .set({ active: false })
      .where(eq(monitor.id, dbMon.id));

    // Fetch updated monitor
    const updated = await getMonitorById(dbMon.id, workspaceId);

    return {
      monitor: updated ? dbMonitorToProto(updated) : undefined,
    };
  },

  async resumeMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const dbMon = await getMonitorById(Number(req.id), workspaceId);

    if (!dbMon) {
      throw new ConnectError(`Monitor ${req.id} not found`, Code.NotFound);
    }

    await db
      .update(monitor)
      .set({ active: true })
      .where(eq(monitor.id, dbMon.id));

    // Fetch updated monitor
    const updated = await getMonitorById(dbMon.id, workspaceId);

    return {
      monitor: updated ? dbMonitorToProto(updated) : undefined,
    };
  },
};
