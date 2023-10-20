import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CloudTasksClient } from "@google-cloud/tasks";
// import type { Payload } from "../../schema";
import type { google } from "@google-cloud/tasks/build/protos/protos";

import { flyRegions } from "@openstatus/tinybird";

import { env } from "@/env";
import { isAuthorizedDomain } from "../_cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs"; // 'nodejs' is the default

export async function GET(req: NextRequest) {
  //   if (isAuthorizedDomain(req.url)) {
  const client = new CloudTasksClient({
    projectId: env.GCP_PROJECT_ID,
    credentials: {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: env.GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
    },
  });
  // Just send 10 random ping to the checker
  for (let i = 0; i < 10; i++) {
    const parent = client.queuePath(
      env.GCP_PROJECT_ID,
      env.GCP_LOCATION,
      "10m",
    );

    const url = "https://api.openstatus.dev/googleTest";

    const payload = {
      status: "active",
      url: "https://www.openstatus.dev",
      method: "GET",
      workspaceId: "1",
      monitorId: "1",
      cronTimestamp: 0,
      pageIds: [],
    };

    for (const region of flyRegions) {
      const task: google.cloud.tasks.v2beta3.ITask = {
        httpRequest: {
          headers: {
            "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
            "fly-prefer-region": region,
            Authorization: `Basic ${env.CRON_SECRET}`,
          },
          httpMethod: "POST",
          url,
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        },
      };
      console.log("Sending task:");
      console.log(task);
      const request = { parent: parent, task: task };
      const [response] = await client.createTask(request);
      console.log(`Created task ${response.name}`);
    }
  }
  //   }
  return NextResponse.json({ success: true });
}
