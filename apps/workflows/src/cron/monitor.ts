import type { google } from "@google-cloud/tasks/build/protos/protos";
import { and, db, eq, isNull, lte, max, ne, or, schema } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { CloudTasksClient } from "@google-cloud/tasks";
import { Redis } from "@openstatus/upstash";
import { z } from "zod";
import { env } from "../env";

const redis = Redis.fromEnv();

const client = new CloudTasksClient({
  projectId: env().GCP_PROJECT_ID,
  credentials: {
    client_email: env().GCP_CLIENT_EMAIL,
    private_key: env().GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
  },
});

export async function LaunchMonitorWorkflow() {
  const threeMonthAgo = new Date().setMonth(new Date().getMonth() - 3);

  const date = new Date(threeMonthAgo);

  // Only free users monitors are paused
  // We don't need to handle multi users per workspace because free workspaces only have one user
  const users = await db
    .select({
      userId: schema.user.id,
      email: schema.user.email,
      lastConnection: schema.user.updatedAt,
      workspaceId: schema.workspace.id,
    })
    .from(user)
    .innerJoin(
      schema.usersToWorkspaces,
      eq(schema.user.id, schema.usersToWorkspaces.userId),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.usersToWorkspaces.workspaceId, schema.workspace.id),
    )
    .where(
      and(
        or(lte(schema.user.updatedAt, date), isNull(schema.user.updatedAt)),
        or(isNull(schema.workspace.plan), ne(schema.workspace.plan, "free")),
      ),
    );
  const parent = client.queuePath(
    env().GCP_PROJECT_ID,
    env().GCP_LOCATION,
    "workflow",
  );
  // iterate over users
  for (const user of users) {
    // check if user has some running monitors
    //
    const nbRunningMonitor = await db.$count(
      schema.monitor,
      and(
        eq(schema.monitor.workspaceId, user.workspaceId),
        eq(schema.monitor.active, true),
        isNull(schema.monitor.deletedAt),
      ),
    );
    if (nbRunningMonitor > 0) {
      continue;
    }
    const isMember = await redis.sismember("workflow:users", user.userId);

    if (isMember) {
      continue;
    }

    await CreateTask({
      parent,
      client: client,
      step: "14days",
    });
    // if they have check if the user is in the workflow
    // If user not in workflow
    //
    // Start workflow -> create task with monitors/start
    // add users to workflow Redis
    console.log(`user worflow started for ${user.userId}`);
  }
}

export async function Step14Days() {
  // Send email saying we are going to pause the monitors
}

export async function Step7Days() {
  // check if user has connected
}

export async function Step1Day() {
  // also check if user has connected
}

export async function StepPaused() {
  // Send Email
  // pause monitors
}

async function hasUserLoggedIn({
  userId,
  date,
}: { userId: number; date: Date }) {
  const userResult = await db
    .select({ lastConnection: schema.user.updatedAt })
    .from(schema.user)
    .where(eq(schema.user.id, userId));

  if (userResult.length === 0) {
    console.error("Something strange no user found", userId);
  }
  const user = userResult[0];
  if (user.lastConnection === null) {
    return false;
  }
  return user.lastConnection > date;
}

function CreateTask({
  parent,
  client,
  step,
}: {
  parent: string;
  client: CloudTasksClient;
  step: z.infer<typeof workflowStepSchema>;
}) {
  const url = "";
  const timestamp = Date.now();
  const payload = {}; // Should we send some data to the task or only in the url/
  const newTask: google.cloud.tasks.v2beta3.ITask = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
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

export const workflowStep = ["14days", "7days", "1day", "paused"] as const;
export const workflowStepSchema = z.enum(workflowStep);
