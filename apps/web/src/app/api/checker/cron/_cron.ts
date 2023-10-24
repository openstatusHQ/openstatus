import type { NextRequest } from "next/server";
import type { SignedInAuthObject } from "@clerk/nextjs/api";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import type { z } from "zod";

import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";
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
    const allPages = await caller.monitor.getAllPagesForMonitor({
      monitorId: row.id,
    });
    const selectedRegions = row.regions.length > 1 ? row.regions : ["auto"];
    for (const region of selectedRegions) {
      const payload: z.infer<typeof payloadSchema> = {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        url: row.url,
        method: row.method || "GET",
        cronTimestamp: timestamp,
        body: row.body,
        headers: row.headers,
        pageIds: allPages.map((p) => String(p.pageId)),
        status: row.status,
      };

      const task: google.cloud.tasks.v2beta3.ITask = {
        httpRequest: {
          headers: {
            "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
            ...(region !== "auto" && { "fly-prefer-region": region }), // Specify the region you want the request to be sent to
            Authorization: `Basic ${env.CRON_SECRET}`,
          },
          httpMethod: "POST",
          url: "https://api.openstatus.dev/checkerV2",
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        },
      };
      const request = { parent: parent, task: task };
      const [response] = await client.createTask(request);

      allResult.push(response);

      /**
       * Pushing to our Golang endpoint
       */
      const tempTask: google.cloud.tasks.v2beta3.ITask = {
        httpRequest: {
          headers: {
            "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
            ...(region !== "auto" && { "fly-prefer-region": region }), // Specify the region you want the request to be sent to
            Authorization: `Basic ${env.CRON_SECRET}`,
          },
          httpMethod: "POST",
          url: "https://checker.openstatus.dev/",
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        },
      };
      const tempRequest = { parent: parent, task: tempTask };
      const [tempResponse] = await client.createTask(tempRequest);

      allResult.push(tempResponse);
    }
  }
  await Promise.all(allResult);
  console.log(`End cron for ${periodicity} with ${allResult.length} jobs`);
};
