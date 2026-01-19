import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  type MonitorService,
  NumberComparator,
  StringComparator,
  RecordComparator,
  type HTTPMonitor,
  type TCPMonitor,
  type DNSMonitor,
  type StatusCodeAssertion,
  type BodyAssertion,
  type HeaderAssertion,
  type RecordAssertion,
  type Headers,
} from "@openstatus/proto/monitor/v1";

import { getRpcContext } from "../interceptors";

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
 * Helper to convert database compare string to NumberComparator.
 */
function compareToNumberComparator(compare: string): NumberComparator {
  switch (compare) {
    case "eq":
      return NumberComparator.EQUAL;
    case "not_eq":
      return NumberComparator.NOT_EQUAL;
    case "gt":
      return NumberComparator.GREATER_THAN;
    case "gte":
      return NumberComparator.GREATER_THAN_OR_EQUAL;
    case "lt":
      return NumberComparator.LESS_THAN;
    case "lte":
      return NumberComparator.LESS_THAN_OR_EQUAL;
    default:
      return NumberComparator.UNSPECIFIED;
  }
}

/**
 * Helper to convert database compare string to StringComparator.
 */
function compareToStringComparator(compare: string): StringComparator {
  switch (compare) {
    case "eq":
      return StringComparator.EQUAL;
    case "not_eq":
      return StringComparator.NOT_EQUAL;
    case "contains":
      return StringComparator.CONTAINS;
    case "not_contains":
      return StringComparator.NOT_CONTAINS;
    case "empty":
      return StringComparator.EMPTY;
    case "not_empty":
      return StringComparator.NOT_EMPTY;
    case "gt":
      return StringComparator.GREATER_THAN;
    case "gte":
      return StringComparator.GREATER_THAN_OR_EQUAL;
    case "lt":
      return StringComparator.LESS_THAN;
    case "lte":
      return StringComparator.LESS_THAN_OR_EQUAL;
    default:
      return StringComparator.UNSPECIFIED;
  }
}

/**
 * Helper to convert database compare string to RecordComparator.
 */
function compareToRecordComparator(compare: string): RecordComparator {
  switch (compare) {
    case "eq":
      return RecordComparator.EQUAL;
    case "not_eq":
      return RecordComparator.NOT_EQUAL;
    case "contains":
      return RecordComparator.CONTAINS;
    case "not_contains":
      return RecordComparator.NOT_CONTAINS;
    default:
      return RecordComparator.UNSPECIFIED;
  }
}

/**
 * Helper to parse database headers JSON and convert to proto Headers array.
 */
function parseDbHeaders(headersJson: string | null): Headers[] {
  if (!headersJson) {
    return [];
  }

  try {
    const headers = JSON.parse(headersJson) as Array<{
      key: string;
      value: string;
    }>;
    return headers.map((h) => ({
      $typeName: "openstatus.monitor.v1.Headers" as const,
      key: h.key,
      value: h.value,
    }));
  } catch {
    return [];
  }
}

/**
 * Helper to parse database assertions JSON for HTTP monitors.
 */
function parseHttpAssertions(assertionsJson: string | null): {
  statusCodeAssertions: StatusCodeAssertion[];
  bodyAssertions: BodyAssertion[];
  headerAssertions: HeaderAssertion[];
} {
  const result: {
    statusCodeAssertions: StatusCodeAssertion[];
    bodyAssertions: BodyAssertion[];
    headerAssertions: HeaderAssertion[];
  } = {
    statusCodeAssertions: [],
    bodyAssertions: [],
    headerAssertions: [],
  };

  if (!assertionsJson) {
    return result;
  }

  try {
    const assertions = JSON.parse(assertionsJson) as Array<{
      type: string;
      compare: string;
      target: string | number;
      key?: string;
    }>;

    for (const a of assertions) {
      switch (a.type) {
        case "status":
          result.statusCodeAssertions.push({
            $typeName: "openstatus.monitor.v1.StatusCodeAssertion" as const,
            target: BigInt(a.target),
            comparator: compareToNumberComparator(a.compare),
          });
          break;
        case "textBody":
        case "jsonBody":
          result.bodyAssertions.push({
            $typeName: "openstatus.monitor.v1.BodyAssertion" as const,
            target: String(a.target),
            comparator: compareToStringComparator(a.compare),
          });
          break;
        case "header":
          result.headerAssertions.push({
            $typeName: "openstatus.monitor.v1.HeaderAssertion" as const,
            target: String(a.target),
            comparator: compareToStringComparator(a.compare),
            key: a.key ?? "",
          });
          break;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return result;
}

/**
 * Helper to parse database assertions JSON for DNS monitors.
 */
function parseDnsAssertions(assertionsJson: string | null): RecordAssertion[] {
  if (!assertionsJson) {
    return [];
  }

  try {
    const assertions = JSON.parse(assertionsJson) as Array<{
      type: string;
      compare: string;
      target: string;
      record?: string;
    }>;

    return assertions
      .filter((a) => a.type === "dns" || a.record)
      .map((a) => ({
        $typeName: "openstatus.monitor.v1.RecordAssertion" as const,
        record: a.record ?? "",
        target: String(a.target),
        comparator: compareToRecordComparator(a.compare),
      }));
  } catch {
    return [];
  }
}

/**
 * Helper to transform database HTTP monitor to proto HTTPMonitor.
 */
function dbMonitorToHttpProto(
  dbMon: NonNullable<Awaited<ReturnType<typeof getMonitorById>>>,
): HTTPMonitor {
  const assertions = parseHttpAssertions(dbMon.assertions);

  return {
    $typeName: "openstatus.monitor.v1.HTTPMonitor",
    id: String(dbMon.id),
    url: dbMon.url,
    periodicity: dbMon.periodicity,
    method: dbMon.method?.toUpperCase() ?? "GET",
    body: dbMon.body ?? "",
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(0),
    followRedirects: dbMon.followRedirects ?? true,
    headers: parseDbHeaders(dbMon.headers),
    statusCodeAssertions: assertions.statusCodeAssertions,
    bodyAssertions: assertions.bodyAssertions,
    headerAssertions: assertions.headerAssertions,
  };
}

/**
 * Helper to transform database TCP monitor to proto TCPMonitor.
 */
function dbMonitorToTcpProto(
  dbMon: NonNullable<Awaited<ReturnType<typeof getMonitorById>>>,
): TCPMonitor {
  return {
    $typeName: "openstatus.monitor.v1.TCPMonitor",
    id: String(dbMon.id),
    uri: dbMon.url,
    periodicity: dbMon.periodicity,
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(0),
  };
}

/**
 * Helper to transform database DNS monitor to proto DNSMonitor.
 */
function dbMonitorToDnsProto(
  dbMon: NonNullable<Awaited<ReturnType<typeof getMonitorById>>>,
): DNSMonitor {
  return {
    $typeName: "openstatus.monitor.v1.DNSMonitor",
    id: String(dbMon.id),
    uri: dbMon.url,
    periodicity: dbMon.periodicity,
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(0),
    recordAssertions: parseDnsAssertions(dbMon.assertions),
  };
}

/**
 * Monitor service implementation for ConnectRPC.
 */
export const monitorServiceImpl: ServiceImpl<typeof MonitorService> = {
  async createHTTPMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "CreateHTTPMonitor not yet implemented",
      Code.Unimplemented,
    );
  },

  async createTCPMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "CreateTCPMonitor not yet implemented",
      Code.Unimplemented,
    );
  },

  async createDNSMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "CreateDNSMonitor not yet implemented",
      Code.Unimplemented,
    );
  },

  async triggerMonitor(_req, _ctx) {
    // TODO: Implement with shared service layer
    throw new ConnectError(
      "TriggerMonitor not yet implemented",
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

    // Group monitors by type
    const httpMonitors: HTTPMonitor[] = [];
    const tcpMonitors: TCPMonitor[] = [];
    const dnsMonitors: DNSMonitor[] = [];

    for (const m of monitors) {
      switch (m.jobType) {
        case "http":
          httpMonitors.push(dbMonitorToHttpProto(m));
          break;
        case "tcp":
          tcpMonitors.push(dbMonitorToTcpProto(m));
          break;
        case "dns":
          dnsMonitors.push(dbMonitorToDnsProto(m));
          break;
      }
    }

    return {
      httpMonitors,
      tcpMonitors,
      dnsMonitors,
      nextPageToken,
    };
  },
};
