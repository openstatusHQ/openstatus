import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import pLimit from "p-limit";
import { z } from "zod";

import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
} from "@openstatus/db";
import {
  type MonitorStatus,
  maintenance,
  monitor,
  monitorStatusTable,
  selectMonitorSchema,
  selectMonitorStatusSchema,
} from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import {
  maintenancesToPageComponents,
  pageComponent,
} from "@openstatus/db/src/schema/page_components";
import { regionDict } from "@openstatus/regions";
import { db } from "../lib/db";

import { getSentry } from "@hono/sentry";
import { getLogger } from "@logtape/logtape";
import type { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import {
  type DNSPayloadSchema,
  getCheckerBaseUrl,
  type httpPayloadSchema,
  isSelfHost,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";
import type { Context } from "hono";
import { env } from "../env";

export const isAuthorizedDomain = (url: string) => {
  return url.includes(env().SITE_URL);
};

const logger = getLogger("workflow");

function hasCloudTaskConfig() {
  return Boolean(
    env().GCP_PROJECT_ID.trim() &&
      env().GCP_CLIENT_EMAIL.trim() &&
      env().GCP_PRIVATE_KEY.trim() &&
      env().GCP_LOCATION.trim(),
  );
}

const channelOptions = {
  // Conservative 5-minute keepalive (gRPC best practice)
  "grpc.keepalive_time_ms": 300000,
  // 5-second timeout sufficient for ping response
  "grpc.keepalive_timeout_ms": 5000,
  // Disable pings without active calls to avoid server conflicts
  "grpc.keepalive_permit_without_calls": 1,
};

export async function sendCheckerTasks(
  periodicity: z.infer<typeof monitorPeriodicitySchema>,
  c: Context,
) {
  if (isSelfHost() || !hasCloudTaskConfig()) {
    await sendCheckerTasksDirect(periodicity, c);
    return;
  }

  const client = new CloudTasksClient({
    fallback: "rest",
    channelOptions,
    projectId: env().GCP_PROJECT_ID,
    credentials: {
      client_email: env().GCP_CLIENT_EMAIL,
      private_key: env().GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
    },
  });

  const parent = client.queuePath(
    env().GCP_PROJECT_ID,
    env().GCP_LOCATION,
    periodicity,
  );

  const timestamp = Date.now();

  const currentMaintenance = db
    .select({ id: maintenance.id })
    .from(maintenance)
    .where(
      and(lte(maintenance.from, new Date()), gte(maintenance.to, new Date())),
    )
    .as("currentMaintenance");

  const currentMaintenanceMonitors = db
    .select({ id: pageComponent.monitorId })
    .from(maintenancesToPageComponents)
    .innerJoin(
      currentMaintenance,
      eq(maintenancesToPageComponents.maintenanceId, currentMaintenance.id),
    )
    .innerJoin(
      pageComponent,
      eq(maintenancesToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(isNotNull(pageComponent.monitorId));

  const result = await db
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.periodicity, periodicity),
        eq(monitor.active, true),
        notInArray(monitor.id, currentMaintenanceMonitors),
      ),
    )
    .all();

  logger.info("Starting cron job", {
    periodicity,
    monitor_count: result.length,
  });

  const monitors = z.array(selectMonitorSchema).safeParse(result);
  const allResult = [];
  if (!monitors.success) {
    logger.error(`Error while fetching the monitors ${monitors.error}`);
    throw new Error("Error while fetching the monitors");
  }

  for (const row of monitors.data) {
    // const selectedRegions = row.regions.length > 0 ? row.regions : ["ams"];

    const result = await db
      .select()
      .from(monitorStatusTable)
      .where(eq(monitorStatusTable.monitorId, row.id))
      .all();
    const monitorStatus = z.array(selectMonitorStatusSchema).safeParse(result);
    if (!monitorStatus.success) {
      logger.error("Failed to parse monitor status", {
        monitor_id: row.id,
        error_message: monitorStatus.error.message,
      });
      continue;
    }

    for (const region of row.regions) {
      const status =
        monitorStatus.data.find((m) => region === m.region)?.status || "active";

      const r = regionDict[region as keyof typeof regionDict];

      if (!r) {
        logger.error(`Invalid region ${region}`);
        continue;
      }
      if (r.deprecated) {
        // Let's uncomment this when we are ready to remove deprecated regions
        // We should not use deprecated regions anymore
        logger.error(`Deprecated region ${region}`);
        continue;
      }
      const response = createCronTask({
        row,
        timestamp,
        client,
        parent,
        status,
        region,
      });
      allResult.push(response);
      if (periodicity === "30s") {
        // we schedule another task in 30s
        const scheduledAt = timestamp + 30 * 1000;
        const response = createCronTask({
          row,
          timestamp: scheduledAt,
          client,
          parent,
          status,
          region,
        });
        allResult.push(response);
      }
    }
  }

  const allRequests = await Promise.allSettled(allResult);

  const success = allRequests.filter((r) => r.status === "fulfilled").length;
  const failed = allRequests.filter((r) => r.status === "rejected").length;

  logger.info("Completed cron job", {
    periodicity,
    total_tasks: allResult.length,
    success_count: success,
    failed_count: failed,
  });
  if (failed > 0) {
    logger.error("Cron job had failures", {
      periodicity,
      failed_count: failed,
      success_count: success,
    });
    getSentry(c).captureMessage(
      `sendCheckerTasks for ${periodicity} ended with ${failed} failed tasks`,
      "error",
    );
  }
}

async function sendCheckerTasksDirect(
  periodicity: z.infer<typeof monitorPeriodicitySchema>,
  c: Context,
) {
  const timestamp = Date.now();
  const selfHostRegion = env().CHECKER_REGION;

  const currentMaintenance = db
    .select({ id: maintenance.id })
    .from(maintenance)
    .where(
      and(lte(maintenance.from, new Date()), gte(maintenance.to, new Date())),
    )
    .as("currentMaintenance");

  const currentMaintenanceMonitors = db
    .select({ id: pageComponent.monitorId })
    .from(maintenancesToPageComponents)
    .innerJoin(
      currentMaintenance,
      eq(maintenancesToPageComponents.maintenanceId, currentMaintenance.id),
    )
    .innerJoin(
      pageComponent,
      eq(maintenancesToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(isNotNull(pageComponent.monitorId));

  const result = await db
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.periodicity, periodicity),
        eq(monitor.active, true),
        notInArray(monitor.id, currentMaintenanceMonitors),
      ),
    )
    .all();

  logger.info("Starting direct self-host checker run", {
    periodicity,
    monitor_count: result.length,
  });

  const monitors = z.array(selectMonitorSchema).safeParse(result);
  const allResult = [];
  const limit = pLimit(10);
  if (!monitors.success) {
    logger.error(`Error while fetching the monitors ${monitors.error}`);
    throw new Error("Error while fetching the monitors");
  }

  // Batch-fetch all monitor statuses in one query instead of N+1
  const monitorIds = monitors.data.map((m) => m.id);
  const allStatuses =
    monitorIds.length > 0
      ? await db
          .select()
          .from(monitorStatusTable)
          .where(inArray(monitorStatusTable.monitorId, monitorIds))
          .all()
      : [];

  // Parse each row individually so one bad row doesn't poison the batch
  const statusByMonitor = new Map<
    number,
    z.infer<typeof selectMonitorStatusSchema>[]
  >();
  for (const raw of allStatuses) {
    const parsed = selectMonitorStatusSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error("Failed to parse monitor status row", {
        monitor_id: raw.monitorId,
        error_message: parsed.error.message,
      });
      continue;
    }
    const list = statusByMonitor.get(parsed.data.monitorId) ?? [];
    list.push(parsed.data);
    statusByMonitor.set(parsed.data.monitorId, list);
  }

  for (const row of monitors.data) {
    const statuses = statusByMonitor.get(row.id);
    if (!statuses) {
      // No status found — treat as active (same as original fallback)
      allResult.push(
        limit(() =>
          dispatchCheckerTaskDirect({ row, timestamp, status: "active" }),
        ),
      );
      continue;
    }
    const status =
      statuses.find((m) => selfHostRegion === m.region)?.status || "active";
    allResult.push(
      limit(() =>
        dispatchCheckerTaskDirect({
          row,
          timestamp,
          status,
        }),
      ),
    );
  }

  if (periodicity === "30s") {
    logger.warn(
      "Self-host direct checker mode does not schedule the delayed second 30s task. Use 1m+ periodicities for reliable self-host operation.",
    );
  }

  const allRequests = await Promise.allSettled(allResult);

  const success = allRequests.filter((r) => r.status === "fulfilled").length;
  const failed = allRequests.filter((r) => r.status === "rejected").length;

  logger.info("Completed direct self-host checker run", {
    periodicity,
    total_tasks: allResult.length,
    success_count: success,
    failed_count: failed,
  });
  if (failed > 0) {
    getSentry(c).captureMessage(
      `direct sendCheckerTasks for ${periodicity} ended with ${failed} failed tasks`,
      "error",
    );
  }
}

function buildCheckerPayload({
  row,
  timestamp,
  status,
}: {
  row: z.infer<typeof selectMonitorSchema>;
  timestamp: number;
  status: MonitorStatus;
}):
  | z.infer<typeof httpPayloadSchema>
  | z.infer<typeof tpcPayloadSchema>
  | z.infer<typeof DNSPayloadSchema> {
  if (row.jobType === "http") {
    return {
      workspaceId: String(row.workspaceId),
      monitorId: String(row.id),
      url: row.url,
      method: row.method || "GET",
      cronTimestamp: timestamp,
      body: row.body,
      headers: row.headers,
      status: status,
      assertions: row.assertions ? JSON.parse(row.assertions) : null,
      degradedAfter: row.degradedAfter,
      timeout: row.timeout,
      trigger: "cron",
      otelConfig: row.otelEndpoint
        ? {
            endpoint: row.otelEndpoint,
            headers: transformHeaders(row.otelHeaders),
          }
        : undefined,
      retry: row.retry || 3,
      followRedirects:
        row.followRedirects === null ? true : row.followRedirects,
    };
  }
  if (row.jobType === "tcp") {
    return {
      workspaceId: String(row.workspaceId),
      monitorId: String(row.id),
      uri: row.url,
      status: status,
      assertions: row.assertions ? JSON.parse(row.assertions) : null,
      cronTimestamp: timestamp,
      degradedAfter: row.degradedAfter,
      timeout: row.timeout,
      trigger: "cron",
      retry: row.retry || 3,
      otelConfig: row.otelEndpoint
        ? {
            endpoint: row.otelEndpoint,
            headers: transformHeaders(row.otelHeaders),
          }
        : undefined,
    };
  }
  if (row.jobType === "dns") {
    return {
      workspaceId: String(row.workspaceId),
      monitorId: String(row.id),
      uri: row.url,
      cronTimestamp: timestamp,
      status: status,
      assertions: row.assertions ? JSON.parse(row.assertions) : null,
      degradedAfter: row.degradedAfter,
      timeout: row.timeout,
      trigger: "cron",
      otelConfig: row.otelEndpoint
        ? {
            endpoint: row.otelEndpoint,
            headers: transformHeaders(row.otelHeaders),
          }
        : undefined,
      retry: row.retry || 3,
    };
  }
  throw new Error(`Unsupported jobType: ${row.jobType}`);
}

async function dispatchCheckerTaskDirect({
  row,
  timestamp,
  status,
}: {
  row: z.infer<typeof selectMonitorSchema>;
  timestamp: number;
  status: MonitorStatus;
}) {
  const payload = buildCheckerPayload({ row, timestamp, status });

  const response = await fetch(
    `${getCheckerBaseUrl()}/checker/${row.jobType}?monitor_id=${row.id}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${env().CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `direct checker request failed for monitor ${row.id} (${row.jobType}) with status ${response.status}: ${body}`,
    );
  }

  return response;
}
// timestamp needs to be in ms
const createCronTask = async ({
  row,
  timestamp,
  client,
  parent,
  status,
  region,
}: {
  row: z.infer<typeof selectMonitorSchema>;
  timestamp: number;
  client: CloudTasksClient;
  parent: string;
  status: MonitorStatus;
  region: Region;
}) => {
  const payload = buildCheckerPayload({ row, timestamp, status });
  const regionInfo = regionDict[region];
  let regionHeader = {};
  if (regionInfo.provider === "fly") {
    regionHeader = { "fly-prefer-region": region };
  }
  if (regionInfo.provider === "koyeb") {
    regionHeader = { "X-KOYEB-REGION-OVERRIDE": region.replace("koyeb_", "") };
  }
  if (regionInfo.provider === "railway") {
    regionHeader = { "railway-region": region.replace("railway_", "") };
  }
  const newTask: google.cloud.tasks.v2beta3.ITask = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
        ...regionHeader,
        Authorization: `Basic ${env().CRON_SECRET}`,
      },
      httpMethod: "POST",
      url: generateUrl({ row, region }),
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: {
      seconds: timestamp / 1000,
    },
  };

  const request = { parent: parent, task: newTask };
  return client.createTask(request);
};

function generateUrl({
  row,
  region,
}: {
  row: z.infer<typeof selectMonitorSchema>;
  region: Region;
}) {
  const regionInfo = regionDict[region];

  switch (regionInfo.provider) {
    case "fly":
      return `https://openstatus-checker.fly.dev/checker/${row.jobType}?monitor_id=${row.id}`;
    case "koyeb":
      return `https://openstatus-checker.koyeb.app/checker/${row.jobType}?monitor_id=${row.id}`;
    case "railway":
      return `https://railway-proxy-production-9cb1.up.railway.app/checker/${row.jobType}?monitor_id=${row.id}`;

    default:
      throw new Error("Invalid jobType");
  }
}
