import { env } from "@/env";
import { getCheckerPayload, getCheckerUrl } from "@/libs/checker";
import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import { and, db, eq, gte, inArray, isNull, sql } from "@openstatus/db";
import { monitor, monitorRun } from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import type {
  DNSMonitor,
  HTTPMonitor,
  MonitorService,
  RegionStatus,
  TCPMonitor,
} from "@openstatus/proto/monitor/v1";

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
  stringToMonitorStatus,
  stringToRegion,
} from "./converters";
import { checkMonitorLimits } from "./limits";
import {
  getCommonDbValues,
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

/**
 * Monitor service implementation for ConnectRPC.
 */
export const monitorServiceImpl: ServiceImpl<typeof MonitorService> = {
  async createHTTPMonitor(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    if (!req.monitor) {
      throw new ConnectError("Monitor is required", Code.InvalidArgument);
    }

    const mon = req.monitor;

    // Validate required fields
    validateCommonMonitorFields(mon);

    if (!mon.url || mon.url.trim().length === 0) {
      throw new ConnectError("Monitor URL is required", Code.InvalidArgument);
    }

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
      throw new ConnectError("Failed to create monitor", Code.Internal);
    }

    // Parse through schema to transform fields
    const parsed = selectMonitorSchema.safeParse(newMonitor);
    if (!parsed.success) {
      throw new ConnectError("Failed to parse monitor data", Code.Internal);
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
      throw new ConnectError("Monitor is required", Code.InvalidArgument);
    }

    const mon = req.monitor;

    // Validate required fields
    validateCommonMonitorFields(mon);

    if (!mon.uri || mon.uri.trim().length === 0) {
      throw new ConnectError("Monitor URI is required", Code.InvalidArgument);
    }

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
      throw new ConnectError("Failed to create monitor", Code.Internal);
    }

    // Parse through schema to transform fields
    const parsed = selectMonitorSchema.safeParse(newMonitor);
    if (!parsed.success) {
      throw new ConnectError("Failed to parse monitor data", Code.Internal);
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
      throw new ConnectError("Monitor is required", Code.InvalidArgument);
    }

    const mon = req.monitor;

    // Validate required fields
    validateCommonMonitorFields(mon);

    if (!mon.uri || mon.uri.trim().length === 0) {
      throw new ConnectError("Monitor URI is required", Code.InvalidArgument);
    }

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
      throw new ConnectError("Failed to create monitor", Code.Internal);
    }

    // Parse through schema to transform fields
    const parsed = selectMonitorSchema.safeParse(newMonitor);
    if (!parsed.success) {
      throw new ConnectError("Failed to parse monitor data", Code.Internal);
    }

    return {
      monitor: dbMonitorToDnsProto(parsed.data),
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
      throw new ConnectError("Upgrade for more checks", Code.ResourceExhausted);
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
      nextPageToken,
    };
  },

  async getMonitorStatus(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Get the monitor
    const dbMon = await getMonitorById(Number(req.id), workspaceId);
    if (!dbMon) {
      throw new ConnectError(`Monitor ${req.id} not found`, Code.NotFound);
    }

    // Parse monitor to get configured regions
    const parsed = selectMonitorSchema.safeParse(dbMon);
    if (!parsed.success) {
      throw new ConnectError("Failed to parse monitor data", Code.Internal);
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
};
