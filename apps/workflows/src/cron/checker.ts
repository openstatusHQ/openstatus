import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import { z } from "zod";

import { and, db, eq, gte, lte, notInArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToMonitors,
  monitor,
  type monitorStatusSchema,
  monitorStatusTable,
  selectMonitorSchema,
  selectMonitorStatusSchema,
} from "@openstatus/db/src/schema";

import type { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import type { httpPayloadSchema, tpcPayloadSchema } from "@openstatus/utils";
import { env } from "../env";

export const isAuthorizedDomain = (url: string) => {
  return url.includes(env().SITE_URL);
};

const client = new CloudTasksClient({
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

      const response = createCronTask({
        monitor: row,
        timestamp,
        client,
        parent,
        status,
        region,
      });
      allResult.push(response);

      // REMINDER: vercel.json cron doesn't support seconds - so we need to schedule another task in 30s
      if (periodicity === "30s") {
        const response = createCronTask({
          monitor: row,
          timestamp: timestamp + 30 * 1000, // we schedule another task in 30s
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
    `End cron for ${periodicity} with ${allResult.length} jobs with ${success} success and ${failed} failed`,
  );
}

async function createCronTask({
  monitor,
  timestamp,
  client,
  parent,
  status,
  region,
}: {
  monitor: z.infer<typeof selectMonitorSchema>;
  status: z.infer<typeof monitorStatusSchema>;
  /**
   * timestamp needs to be in ms
   */
  timestamp: number;
  client: CloudTasksClient;
  parent: string;
  region: string;
}) {
  let payload:
    | z.infer<typeof httpPayloadSchema>
    | z.infer<typeof tpcPayloadSchema>
    | null = null;
  let url: string | null = null;

  //
  if (monitor.jobType === "http") {
    payload = {
      workspaceId: String(monitor.workspaceId),
      monitorId: String(monitor.id),
      url: monitor.url,
      method: monitor.method || "GET",
      cronTimestamp: timestamp,
      body: monitor.body,
      headers: monitor.headers,
      status: status,
      assertions: monitor.assertions ? JSON.parse(monitor.assertions) : null,
      degradedAfter: monitor.degradedAfter,
      timeout: monitor.timeout,
      trigger: "cron",
    } satisfies z.infer<typeof httpPayloadSchema>;
    url = `https://openstatus-checker.fly.dev/checker/http?monitor_id=${monitor.id}`;
  }
  if (monitor.jobType === "tcp") {
    payload = {
      workspaceId: String(monitor.workspaceId),
      monitorId: String(monitor.id),
      uri: monitor.url,
      status: status,
      assertions: monitor.assertions ? JSON.parse(monitor.assertions) : null,
      cronTimestamp: timestamp,
      degradedAfter: monitor.degradedAfter,
      timeout: monitor.timeout,
      trigger: "cron",
    } satisfies z.infer<typeof tpcPayloadSchema>;
    url = `https://openstatus-checker.fly.dev/checker/tcp?monitor_id=${monitor.id}`;
  }

  if (!payload || !url) {
    throw new Error("Invalid jobType");
  }

  const newTask: google.cloud.tasks.v2beta3.ITask = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
        "fly-prefer-region": region, // Specify the region you want the request to be sent to
        Authorization: `Basic ${env().CRON_SECRET}`,
      },
      httpMethod: "POST",
      url,
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: {
      seconds: timestamp / 1000,
    },
  };

  const request = { parent: parent, task: newTask };
  return client.createTask(request);
}
