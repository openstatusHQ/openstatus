import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import {
  and,
  db,
  desc,
  eq,
  isNull,
  lte,
  max,
  ne,
  or,
  schema,
} from "@openstatus/db";
import { session, user } from "@openstatus/db/src/schema";
import {
  MonitorDeactivationEmail,
  MonitorPausedEmail,
} from "@openstatus/emails";
import { sendWithRender } from "@openstatus/emails/src/send";
import { Redis } from "@openstatus/upstash";
import { RateLimiter } from "limiter";
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

const limiter = new RateLimiter({ tokensPerInterval: 15, interval: "second" });

export async function LaunchMonitorWorkflow() {
  // Expires is one month after last connection, so if we want to reach people who connected 3 months ago we need to check for people with  expires 2 months ago
  const twoMonthAgo = new Date().setMonth(new Date().getMonth() - 2);

  const date = new Date(twoMonthAgo);
  // User without session
  const userWithoutSession = db
    .select({
      userId: schema.user.id,
      email: schema.user.email,
      updatedAt: schema.user.updatedAt,
    })
    .from(schema.user)
    .leftJoin(schema.session, eq(schema.session.userId, schema.user.id))
    .where(isNull(schema.session.userId))
    .as("query");
  // Only free users monitors are paused
  // We don't need to handle multi users per workspace because free workspaces only have one user
  // Only free users monitors are paused

  const u1 = await db
    .select({
      userId: userWithoutSession.userId,
      email: userWithoutSession.email,
      workspaceId: schema.workspace.id,
    })
    .from(userWithoutSession)
    .innerJoin(
      schema.usersToWorkspaces,
      eq(userWithoutSession.userId, schema.usersToWorkspaces.userId),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.usersToWorkspaces.workspaceId, schema.workspace.id),
    )
    .where(
      and(
        or(
          lte(userWithoutSession.updatedAt, date),
          isNull(userWithoutSession.updatedAt),
        ),
        or(isNull(schema.workspace.plan), eq(schema.workspace.plan, "free")),
      ),
    );

  console.log(`Found ${u1.length} users without session to start the workflow`);
  const maxSessionPerUser = db
    .select({
      userId: schema.user.id,
      email: schema.user.email,
      lastConnection: max(schema.session.expires).as("lastConnection"),
    })
    .from(schema.user)
    .innerJoin(schema.session, eq(schema.session.userId, schema.user.id))
    .groupBy(schema.user.id)
    .as("maxSessionPerUser");
  // Only free users monitors are paused
  // We don't need to handle multi users per workspace because free workspaces only have one user
  // Only free users monitors are paused

  const u = await db
    .select({
      userId: maxSessionPerUser.userId,
      email: maxSessionPerUser.email,
      workspaceId: schema.workspace.id,
    })
    .from(maxSessionPerUser)
    .innerJoin(
      schema.usersToWorkspaces,
      eq(maxSessionPerUser.userId, schema.usersToWorkspaces.userId),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.usersToWorkspaces.workspaceId, schema.workspace.id),
    )
    .where(
      and(
        lte(maxSessionPerUser.lastConnection, date),
        or(isNull(schema.workspace.plan), eq(schema.workspace.plan, "free")),
      ),
    );
  // Let's merge both results
  const users = [...u, ...u1];
  // iterate over users

  const allResult = [];

  for (const user of users) {
    await limiter.removeTokens(1);
    const workflow = workflowInit({ user });
    allResult.push(workflow);
  }

  const allRequests = await Promise.allSettled(allResult);

  const success = allRequests.filter((r) => r.status === "fulfilled").length;
  const failed = allRequests.filter((r) => r.status === "rejected").length;

  console.log(
    `End cron with ${allResult.length} jobs with ${success} success and ${failed} failed`,
  );
}

async function workflowInit({
  user,
}: {
  user: {
    userId: number;
    email: string | null;
    workspaceId: number;
  };
}) {
  console.log(`Starting workflow for ${user.userId}`);
  // Let's check if the user is in the workflow
  const isMember = await redis.sismember("workflow:users", user.userId);
  if (isMember) {
    console.log(`user workflow already started for ${user.userId}`);
    return;
  }
  // check if user has some running monitors
  const nbRunningMonitor = await db.$count(
    schema.monitor,
    and(
      eq(schema.monitor.workspaceId, user.workspaceId),
      eq(schema.monitor.active, true),
      isNull(schema.monitor.deletedAt),
    ),
  );
  if (nbRunningMonitor === 0) {
    console.log(`user has no running monitors for ${user.userId}`);
    return;
  }
  await CreateTask({
    parent,
    client: client,
    step: "14days",
    userId: user.userId,
    initialRun: new Date().getTime(),
  });
  // // Add our user to the list of users that have started the workflow

  await redis.sadd("workflow:users", user.userId);
  console.log(`user workflow started for ${user.userId}`);
}

export async function Step14Days(userId: number, workFlowRunTimestamp: number) {
  const user = await getUser(userId);

  // Send email saying we are going to pause the monitors
  // The task has just been created we don't double check if the user has logged in :scary:
  // send First email
  // TODO: Send email

  if (user.email) {
    await sendWithRender({
      to: [user.email],
      subject: "Your OpenStatus monitors will be paused soon",
      from: "Thibault From OpenStatus <thibault@notifications.openstatus.dev>",
      reply_to: "thibault@openstatus.dev",

      react: MonitorDeactivationEmail({
        deactivateAt: new Date(new Date().setDate(new Date().getDate() + 14)),
      }),
    });

    await CreateTask({
      parent,
      client: client,
      step: "3days",
      userId: user.id,
      initialRun: workFlowRunTimestamp,
    });
  }
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

  const user = await getUser(userId);

  if (user.email) {
    await sendWithRender({
      to: [user.email],
      subject: "Your OpenStatus monitors will be paused in 3 days",
      from: "Thibault From OpenStatus <thibault@notifications.openstatus.dev>",
      reply_to: "thibault@openstatus.dev",

      react: MonitorDeactivationEmail({
        deactivateAt: new Date(new Date().setDate(new Date().getDate() + 3)),
      }),
    });
  }

  // Send second email
  //TODO: Send email
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
        workspaceId: schema.workspace.id,
      })
      .from(user)
      .innerJoin(session, eq(schema.user.id, schema.session.userId))
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
          or(isNull(schema.workspace.plan), eq(schema.workspace.plan, "free")),
          eq(schema.user.id, userId),
        ),
      )
      .get();
    // We should only have one user :)
    if (!users) {
      throw new Error("Too many users found");
    }

    await db
      .update(schema.monitor)
      .set({ active: false })
      .where(eq(schema.monitor.workspaceId, users.workspaceId));
    // Send last email with pause monitor
  }

  const currentUser = await getUser(userId);
  // TODO: Send email
  // Remove user for workflow

  if (currentUser.email) {
    await sendWithRender({
      to: [currentUser.email],
      subject: "Your monitors have been paused",
      from: "Thibault From OpenStatus <thibault@notifications.openstatus.dev>",
      reply_to: "thibault@openstatus.dev",
      react: MonitorPausedEmail(),
    });
  }
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
    .select({ lastSession: schema.session.expires })
    .from(schema.session)
    .where(eq(schema.session.userId, userId))
    .orderBy(desc(schema.session.expires));

  if (userResult.length === 0) {
    return false;
  }
  const user = userResult[0];
  if (user.lastSession === null) {
    return false;
  }
  return user.lastSession > date;
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
  const newTask: google.cloud.tasks.v2beta3.ITask = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
        Authorization: `${env().CRON_SECRET}`,
      },
      httpMethod: "GET",
      url,
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

async function getUser(userId: number) {
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(schema.user.id, userId))
    .get();

  if (!currentUser) {
    throw new Error("User not found");
  }
  if (!currentUser.email) {
    throw new Error("User email not found");
  }
  return currentUser;
}
