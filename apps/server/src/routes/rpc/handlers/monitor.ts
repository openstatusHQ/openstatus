import { env } from "@/env";
import { getCheckerPayload, getCheckerUrl } from "@/libs/checker";
import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, gte, isNull, sql } from "@openstatus/db";
import { monitorPeriodicity } from "@openstatus/db/src/schema/constants";
import { monitor, monitorRun } from "@openstatus/db/src/schema";
import { monitorMethods } from "@openstatus/db/src/schema/monitors/constants";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import type {
  DNSMonitor,
  HTTPMonitor,
  MonitorService,
  TCPMonitor,
} from "@openstatus/proto/monitor/v1";

type MonitorPeriodicity = (typeof monitorPeriodicity)[number];
type MonitorMethod = (typeof monitorMethods)[number];

/**
 * Validate and convert periodicity string to enum type.
 */
function toValidPeriodicity(value: string | undefined): MonitorPeriodicity {
  const valid = monitorPeriodicity as readonly string[];
  if (value && valid.includes(value)) {
    return value as MonitorPeriodicity;
  }
  return "1m";
}

/**
 * Validate and convert method string to enum type.
 */
function toValidMethod(value: string | undefined): MonitorMethod {
  const upper = value?.toUpperCase();
  const valid = monitorMethods as readonly string[];
  if (upper && valid.includes(upper)) {
    return upper as MonitorMethod;
  }
  return "GET";
}

import { getRpcContext } from "../interceptors";
import {
  dbMonitorToDnsProto,
  dbMonitorToHttpProto,
  dbMonitorToTcpProto,
  dnsAssertionsToDbJson,
  headersToDbJson,
  httpAssertionsToDbJson,
} from "./monitor-utils";

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
 * Monitor service implementation for ConnectRPC.
 */
export const monitorServiceImpl: ServiceImpl<typeof MonitorService> = {
  async createHTTPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.monitor) {
      throw new ConnectError("Monitor is required", Code.InvalidArgument);
    }

    const mon = req.monitor;

    // Convert headers to DB format
    const headers = headersToDbJson(mon.headers);

    // Convert assertions to DB format
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
        periodicity: toValidPeriodicity(mon.periodicity),
        method: toValidMethod(mon.method),
        body: mon.body || undefined,
        timeout: mon.timeout ? Number(mon.timeout) : 45000,
        degradedAfter: mon.degradedAt ? Number(mon.degradedAt) : undefined,
        headers,
        assertions,
        followRedirects: mon.followRedirects ?? true,
        active: false,
      })
      .returning()
      .get();

    if (!newMonitor) {
      throw new ConnectError("Failed to create monitor", Code.Internal);
    }

    return {
      monitor: dbMonitorToHttpProto(newMonitor),
    };
  },

  async createTCPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.monitor) {
      throw new ConnectError("Monitor is required", Code.InvalidArgument);
    }

    const mon = req.monitor;

    // Insert into database
    const newMonitor = await db
      .insert(monitor)
      .values({
        workspaceId,
        jobType: "tcp",
        url: mon.uri,
        periodicity: toValidPeriodicity(mon.periodicity),
        timeout: mon.timeout ? Number(mon.timeout) : 45000,
        degradedAfter: mon.degradedAt ? Number(mon.degradedAt) : undefined,
        active: false,
      })
      .returning()
      .get();

    if (!newMonitor) {
      throw new ConnectError("Failed to create monitor", Code.Internal);
    }

    return {
      monitor: dbMonitorToTcpProto(newMonitor),
    };
  },

  async createDNSMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.monitor) {
      throw new ConnectError("Monitor is required", Code.InvalidArgument);
    }

    const mon = req.monitor;

    // Convert assertions to DB format
    const assertions = dnsAssertionsToDbJson(mon.recordAssertions);

    // Insert into database
    const newMonitor = await db
      .insert(monitor)
      .values({
        workspaceId,
        jobType: "dns",
        url: mon.uri,
        periodicity: toValidPeriodicity(mon.periodicity),
        timeout: mon.timeout ? Number(mon.timeout) : 45000,
        degradedAfter: mon.degradedAt ? Number(mon.degradedAt) : undefined,
        assertions,
        active: false,
      })
      .returning()
      .get();

    if (!newMonitor) {
      throw new ConnectError("Failed to create monitor", Code.Internal);
    }

    return {
      monitor: dbMonitorToDnsProto(newMonitor),
    };
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
      throw new ConnectError(
        "Upgrade for more checks",
        Code.ResourceExhausted,
      );
    }

    // Get the monitor
    const dbMon = await getMonitorById(Number(req.id), workspaceId);
    if (!dbMon) {
      throw new ConnectError(`Monitor ${req.id} not found`, Code.NotFound);
    }

    // Validate monitor data
    const validateMonitor = selectMonitorSchema.safeParse(dbMon);
    if (!validateMonitor.success) {
      throw new ConnectError(
        "Invalid monitor data, please contact support",
        Code.Internal,
      );
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
      throw new ConnectError("Failed to create monitor run", Code.Internal);
    }

    // Trigger checks for each region
    const allResults = [];
    for (const region of validateMonitor.data.regions) {
      const statusEntry = monitorStatuses.find((m) => region === m.region);
      const status = statusEntry?.status || "active";
      const payload = getCheckerPayload(row, status);
      const url = getCheckerUrl(row);

      const result = fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "fly-prefer-region": region,
          Authorization: `Basic ${env.CRON_SECRET}`,
        },
        method: "POST",
        body: JSON.stringify(payload),
      });

      allResults.push(result);
    }

    await Promise.all(allResults);

    return { success: true };
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
