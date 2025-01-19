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

const parent = client.queuePath(
  env().GCP_PROJECT_ID,
  env().GCP_LOCATION,
  "workflow",
);

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
      userId: user.userId,
      initialRun: new Date().getTime(),
    });
    // Add our user to the list of users that have started the workflow

    await redis.sadd("workflow:users", user.userId);
    console.log(`user worflow started for ${user.userId}`);
  }
}

export async function Step14Days(userId: number) {
  // Send email saying we are going to pause the monitors
  // The task has just been created we don't double check if the user has logged in :scary:
  // send First email
}

export async function Step3Days(userId: number, workFlowRunTimestamp: number) {
  // check if user has connected
  const hasConnected = await hasUserLoggedIn({
    userId,
    date: new Date(workFlowRunTimestamp),
  });

  if (hasConnected) {
    //
    await redis.srem("workflow:users", userId);
    return;
  }
  // Send second email
  // Let's schedule the next task
  await CreateTask({
    client,
    parent,
    step: "paused",
    userId,
    initialRun: workFlowRunTimestamp,
  });
}

export async function StepPaused(userId: number, workFlowRunTimestamp: number) {
  const hasConnected = await hasUserLoggedIn({
    userId,
    date: new Date(workFlowRunTimestamp),
  });
  if (!hasConnected) {
    // sendSecond pause email
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
          or(isNull(schema.workspace.plan), ne(schema.workspace.plan, "free")),
          eq(schema.user.id, userId),
        ),
      );
    // We should only have one user :)
    if (users.length !== 1) {
      throw new Error("Too much users found");
    }
    const workspaceId = users[0].workspaceId;
    await db
      .update(schema.monitor)
      .set({ active: false })
      .where(eq(schema.monitor.workspaceId, workspaceId));
    // Send last email with pause monitor
  }
  // Remove user for workflow
  await redis.srem("workflow:users", userId);
}

async function hasUserLoggedIn({
  userId,
  date,
}: {
  userId: number;
  date: Date;
}) {
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
  userId,
  initialRun,
}: {
  parent: string;
  client: CloudTasksClient;
  step: z.infer<typeof workflowStepSchema>;
  userId: number;
  initialRun: number;
}) {
  const url = `https://openstatus-workflows.fly.dev/cron/monitors/${step}?userId=${userId}&initialRun=${initialRun}`;
  const timestamp = getScheduledTime(step);
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
      seconds: timestamp,
    },
  };

  const request = { parent: parent, task: newTask };
  return client.createTask(request);
}

function getScheduledTime(step: z.infer<typeof workflowStepSchema>) {
  switch (step) {
    case "14days":
      // let's triger it now
      return new Date().getTime() / 1000;
    case "3days":
      // it's 11 days after the 14 days
      return new Date().setDate(new Date().getDate() + 11) / 1000;
    case "paused":
      // it's 3 days after the 3 days step
      return new Date().setDate(new Date().getDate() + 3) / 1000;
    default:
      throw new Error("Invalid step");
  }
}

export const workflowStep = ["14days", "3days", "paused"] as const;
export const workflowStepSchema = z.enum(workflowStep);
