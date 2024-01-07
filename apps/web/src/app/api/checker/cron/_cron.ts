import type { NextRequest } from "next/server";
import type { SignedInAuthObject } from "@clerk/nextjs/api";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import type { z } from "zod";

import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import { selectMonitorSchema } from "@openstatus/db/src/schema";

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
    periodicity,
  );

  console.log(`Start cron for ${periodicity}`);
  const timestamp = Date.now();

  const ctx = createTRPCContext({ req, serverSideCall: true });
  ctx.auth = { userId: "cron" } as SignedInAuthObject;
  const caller = edgeRouter.createCaller(ctx);

  const monitors = await caller.monitor.getMonitorsForPeriodicity({
    periodicity: periodicity,
  });

  const allResult = [];

  for (const row of monitors) {
    const selectedRegions = row.regions.length > 1 ? row.regions : ["auto"];

    const monitorStatus = await caller.monitor.getMonitorStatusByMonitorId({
      monitorId: row.id,
    });

    for (const region of selectedRegions) {
      const status =
        monitorStatus.find(({ region }) => region === region)?.status ||
        "active";
      const response = await createCronTask({
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
        const scheduledAt = timestamp / 1000 + 30;
        const response = await createCronTask({
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
  await Promise.all(allResult);
  console.log(`End cron for ${periodicity} with ${allResult.length} jobs`);
};

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
  };

  const newTask: google.cloud.tasks.v2beta3.ITask = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
        "fly-prefer-region": region, // Specify the region you want the request to be sent to
        Authorization: `Basic ${env.CRON_SECRET}`,
      },
      httpMethod: "POST",
      url: "https://openstatus-checker.fly.dev/checker",
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: {
      seconds: timestamp,
    },
  };

  const request = { parent: parent, task: newTask };
  const [response] = await client.createTask(request);
  return response;
};
