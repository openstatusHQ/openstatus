import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { and, db, eq, gte, lte, notInArray } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import {
  maintenance,
  maintenancesToMonitors,
  monitor,
  monitorStatusTable,
  selectMonitorSchema,
  selectMonitorStatusSchema,
} from "@openstatus/db/src/schema";

import { env } from "@/env";
import type { payloadSchema } from "../schema";

const periodicityAvailable = selectMonitorSchema.pick({ periodicity: true });

// FIXME: do coerce in zod instead

const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

// We can't secure cron endpoint by vercel thus we should make sure they are called by the generated url
export const isAuthorizedDomain = (url: string) => {
  return url.includes(DEFAULT_URL);
};

export const cron = async ({
  periodicity,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  req,
}: z.infer<typeof periodicityAvailable> & { req: NextRequest }) => {
  const client = new CloudTasksClient({
    projectId: env.GCP_PROJECT_ID,
    credentials: {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: env.GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
    },
  });
  const parent = client.queuePath(
    env.GCP_PROJECT_ID,
    env.GCP_LOCATION,
    periodicity
  );

  const timestamp = Date.now();

  const currentMaintenance = db
    .select({ id: maintenance.id })
    .from(maintenance)
    .where(
      and(lte(maintenance.from, new Date()), gte(maintenance.to, new Date()))
    )
    .as("currentMaintenance");

  const currentMaintenanceMonitors = db
    .select({ id: maintenancesToMonitors.monitorId })
    .from(maintenancesToMonitors)
    .innerJoin(
      currentMaintenance,
      eq(maintenancesToMonitors.maintenanceId, currentMaintenance.id)
    );

  const result = await db
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.periodicity, periodicity),
        eq(monitor.active, true),
        notInArray(monitor.id, currentMaintenanceMonitors)
      )
    )
    .all();

  console.log(`Start cron for ${periodicity}`);

  const monitors = z.array(selectMonitorSchema).parse(result);
  const allResult = [];

  for (const row of monitors) {
    const selectedRegions = row.regions.length > 0 ? row.regions : ["ams"];

    const result = await db
      .select()
      .from(monitorStatusTable)
      .where(eq(monitorStatusTable.monitorId, row.id))
      .all();
    const monitorStatus = z.array(selectMonitorStatusSchema).parse(result);

    for (const region of selectedRegions) {
      const status =
        monitorStatus.find((m) => region === m.region)?.status || "active";
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

  console.log(
    `End cron for ${periodicity} with ${allResult.length} jobs with ${success} success and ${failed} failed`
  );
};
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
  region: string;
}) => {
  const payload: z.infer<typeof payloadSchema> = {
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
    timeout: row.timeout || 45000,
  };

  const newTask: google.cloud.tasks.v2beta3.ITask = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
        "fly-prefer-region": region, // Specify the region you want the request to be sent to
        Authorization: `Basic ${env.CRON_SECRET}`,
      },
      httpMethod: "POST",
      url: `https://openstatus-checker.fly.dev/checker?monitor_id=${row.id}`,
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: {
      seconds: timestamp / 1000,
    },
  };

  const request = { parent: parent, task: newTask };
  return client.createTask(request);
};
