import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import { z } from "zod";

import { and, eq, gte, lte, notInArray } from "@openstatus/db";
import {
  type MonitorStatus,
  maintenance,
  maintenancesToMonitors,
  monitor,
  monitorStatusTable,
  selectMonitorSchema,
  selectMonitorStatusSchema,
} from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import { regionDict } from "@openstatus/regions";
import { db } from "../lib/db";

import type { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import {
  type httpPayloadSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";
import { env } from "../env";

export const isAuthorizedDomain = (url: string) => {
  return url.includes(env().SITE_URL);
};

const channelOptions = {
  // Conservative 5-minute keepalive (gRPC best practice)
  'grpc.keepalive_time_ms': 300000,
  // 5-second timeout sufficient for ping response
  'grpc.keepalive_timeout_ms': 5000,
  // Disable pings without active calls to avoid server conflicts
  'grpc.keepalive_permit_without_calls': 1,
};

const client = new CloudTasksClient({
  channelOptions,
  projectId: env().GCP_PROJECT_ID,
  credentials: {
    client_email: env().GCP_CLIENT_EMAIL,
    private_key: env().GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
  },
});

export async function sendCheckerTasks(
  periodicity: z.infer<typeof monitorPeriodicitySchema>,
) {
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
    .select({ id: maintenancesToMonitors.monitorId })
    .from(maintenancesToMonitors)
    .innerJoin(
      currentMaintenance,
      eq(maintenancesToMonitors.maintenanceId, currentMaintenance.id),
    );

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

  console.log(`Start cron for ${periodicity}`);

  const monitors = z.array(selectMonitorSchema).safeParse(result);
  const allResult = [];
  if (!monitors.success) {
    console.error(`Error while fetching the monitors ${monitors.error.errors}`);
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
      console.error(
        `Error while fetching the monitor status ${monitorStatus.error.errors}`,
      );
      continue;
    }

    for (const region of row.regions) {
      const status =
        monitorStatus.data.find((m) => region === m.region)?.status || "active";

      const r = regionDict[region as keyof typeof regionDict];

      if (!r) {
        console.error(`Invalid region ${region}`);
        continue;
      }
      if (r.deprecated) {
        // Let's uncomment this when we are ready to remove deprecated regions
        // We should not use deprecated regions anymore
        console.error(`Deprecated region ${region}`);
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
  const failedRequest = allRequests.filter((r) => r.status === "rejected")
  console.log(failedRequest?.at(0))
  console.log(
    `End cron for ${periodicity} with ${allResult.length} jobs with ${success} success and ${failed} failed`,
  );
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
  let payload:
    | z.infer<typeof httpPayloadSchema>
    | z.infer<typeof tpcPayloadSchema>
    | null = null;

  //
  if (row.jobType === "http") {
    payload = {
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
      followRedirects: row.followRedirects || true,
    };
  }
  if (row.jobType === "tcp") {
    payload = {
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

  if (!payload) {
    throw new Error("Invalid jobType");
  }
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
