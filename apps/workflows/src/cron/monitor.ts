import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos";
import {
  monitorDeactivationEmail,
  monitorPausedEmail,
} from "@openstatus/emails";
import {
  type EmailHtml,
  sendBatchEmailHtml,
} from "@openstatus/emails/src/send";
import {
  bulkUpdateMonitors,
  countActiveMonitors,
  listActiveMonitorIds,
} from "@openstatus/services/monitor";
import {
  getFreeWorkspaceOfUser,
  getLatestSessionExpiry,
  getUserContact,
  listFreeUsersLastSeenBefore,
  listFreeUsersWithoutSession,
} from "@openstatus/services/user";
import { Redis } from "@openstatus/upstash";
import { RateLimiter } from "limiter";
import { z } from "zod";

import { env } from "../env";

const redis = Redis.fromEnv();

const PAUSE_FROM = "Thibault from openstatus <thibault@mail.openstatus.dev>";
const PAUSE_REPLY_TO = "thibault@openstatus.dev";

// Check if GCP is properly configured (not empty and not placeholder values)
const isGcpConfigured = () => {
  const gcpProjectId = env().GCP_PROJECT_ID;
  const gcpLocation = env().GCP_LOCATION;
  const gcpClientEmail = env().GCP_CLIENT_EMAIL;
  const gcpPrivateKey = env().GCP_PRIVATE_KEY;

  return (
    gcpProjectId &&
    gcpLocation &&
    gcpClientEmail &&
    gcpPrivateKey &&
    gcpProjectId !== "" &&
    gcpLocation !== "" &&
    gcpClientEmail !== "" &&
    gcpPrivateKey !== "" &&
    gcpProjectId !== "your-value" &&
    gcpLocation !== "your-value" &&
    gcpClientEmail !== "your-value" &&
    gcpPrivateKey !== "your-value"
  );
};

// Only initialize Cloud Tasks client if GCP is properly configured
let client: CloudTasksClient | null = null;
let parent: string | null = null;

if (isGcpConfigured()) {
  client = new CloudTasksClient({
    projectId: env().GCP_PROJECT_ID,
    fallback: "rest",
    credentials: {
      client_email: env().GCP_CLIENT_EMAIL,
      private_key: env().GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
    },
  });

  parent = client.queuePath(
    env().GCP_PROJECT_ID,
    env().GCP_LOCATION,
    "workflow",
  );
}

const limiter = new RateLimiter({ tokensPerInterval: 15, interval: "second" });

export async function LaunchMonitorWorkflow() {
  // Expires is one month after last connection, so if we want to reach people who connected 3 months ago we need to check for people with  expires 2 months ago
  const twoMonthAgo = new Date().setMonth(new Date().getMonth() - 2);

  const date = new Date(twoMonthAgo);
  // Only free users monitors are paused
  // We don't need to handle multi users per workspace because free workspaces only have one user
  const u1 = await listFreeUsersWithoutSession({ before: date });

  console.log(`Found ${u1.length} users without session to start the workflow`);
  const u = await listFreeUsersLastSeenBefore({ before: date });
  const usersMap = new Map<number, (typeof u)[number]>();
  for (const entry of [...u, ...u1]) {
    usersMap.set(entry.userId, entry);
  }
  const users = Array.from(usersMap.values());
  const duplicatesRemoved = u.length + u1.length - users.length;
  if (duplicatesRemoved > 0) {
    console.log(`Removed ${duplicatesRemoved} duplicate users`);
  }

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
  const isMember = await redis.exists(`workflow:user:${user.userId}`);
  if (isMember) {
    console.log(`user workflow already started for ${user.userId}`);
    return;
  }
  // check if user has some running monitors
  const nbRunningMonitor = await countActiveMonitors({
    workspaceId: user.workspaceId,
  });
  if (nbRunningMonitor === 0) {
    console.log(`user has no running monitors for ${user.userId}`);
    return;
  }
  const initialRun = new Date().getTime();

  // Only create GCP Cloud Tasks if GCP is configured
  if (!client || !parent) {
    console.log(
      `Skipping workflow for user ${user.userId} - GCP not configured`,
    );
    return;
  }

  await CreateTask({
    parent,
    client: client,
    step: "14days",
    userId: user.userId,
    initialRun,
  });

  await redis.set(`workflow:user:${user.userId}`, initialRun, {
    ex: 30 * 86400,
  });
  console.log(`user workflow started for ${user.userId}`);
}

export async function Step14Days(userId: number, workFlowRunTimestamp: number) {
  const hasConnected = await hasUserLoggedIn({
    userId,
    date: new Date(workFlowRunTimestamp),
  });

  if (hasConnected) {
    await redis.del(`workflow:user:${userId}`);
    return;
  }

  const user = await getUser(userId);

  if (user.email) {
    const email = await monitorDeactivationEmail({
      deactivateAt: new Date(new Date().setDate(new Date().getDate() + 14)),
      ...(await getPauseContext(userId)),
    });
    await sendWorkflowEmail({
      userId,
      step: "14days",
      initialRun: workFlowRunTimestamp,
      email: {
        to: user.email,
        from: PAUSE_FROM,
        reply_to: PAUSE_REPLY_TO,
        ...email,
      },
    });
  }

  // Only create GCP Cloud Tasks if GCP is configured
  if (client && parent) {
    await CreateTask({
      parent,
      client: client,
      step: "3days",
      userId: user.id,
      initialRun: workFlowRunTimestamp,
    });
  } else {
    console.log(
      `Skipping Cloud Tasks creation for user ${user.id} - GCP not configured`,
    );
  }
}

export async function Step3Days(userId: number, workFlowRunTimestamp: number) {
  const hasConnected = await hasUserLoggedIn({
    userId,
    date: new Date(workFlowRunTimestamp),
  });

  if (hasConnected) {
    await redis.del(`workflow:user:${userId}`);
    return;
  }

  const user = await getUser(userId);

  if (user.email) {
    const email = await monitorDeactivationEmail({
      deactivateAt: new Date(new Date().setDate(new Date().getDate() + 3)),
      ...(await getPauseContext(userId)),
    });
    await sendWorkflowEmail({
      userId,
      step: "3days",
      initialRun: workFlowRunTimestamp,
      email: {
        to: user.email,
        from: PAUSE_FROM,
        reply_to: PAUSE_REPLY_TO,
        ...email,
      },
    });
  }

  // Only create GCP Cloud Tasks if GCP is configured
  if (client && parent) {
    await CreateTask({
      client,
      parent,
      step: "paused",
      userId,
      initialRun: workFlowRunTimestamp,
    });
  } else {
    console.log(
      `Skipping Cloud Tasks creation for user ${userId} - GCP not configured`,
    );
  }
}

export async function StepPaused(userId: number, workFlowRunTimestamp: number) {
  try {
    const hasConnected = await hasUserLoggedIn({
      userId,
      date: new Date(workFlowRunTimestamp),
    });

    if (hasConnected) {
      return;
    }

    const workspace = await getUserWorkspace(userId);
    let pausedCount = 0;
    if (workspace) {
      const activeMonitorIds = await listActiveMonitorIds({
        workspaceId: workspace.id,
      });
      pausedCount = activeMonitorIds.length;
      if (activeMonitorIds.length > 0) {
        await bulkUpdateMonitors({
          ctx: {
            workspace,
            actor: { type: "system", job: "monitor-auto-pause" },
          },
          input: { ids: activeMonitorIds, active: false },
        });
      }
    }

    const currentUser = await getUser(userId);
    if (currentUser.email) {
      const email = await monitorPausedEmail({
        monitorCount: pausedCount || undefined,
        workspaceSlug: workspace?.slug,
      });
      await sendWorkflowEmail({
        userId,
        step: "paused",
        initialRun: workFlowRunTimestamp,
        email: {
          to: currentUser.email,
          from: PAUSE_FROM,
          reply_to: PAUSE_REPLY_TO,
          ...email,
        },
      });
    }
  } finally {
    await redis.del(`workflow:user:${userId}`);
  }
}

async function hasUserLoggedIn({
  userId,
  date,
}: {
  userId: number;
  date: Date;
}) {
  const lastSession = await getLatestSessionExpiry({ userId });
  if (lastSession === null) {
    return false;
  }
  return lastSession > date;
}

async function CreateTask({
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
  const taskName = `${parent}/tasks/workflow-${userId}-${step}-${initialRun}`;
  const newTask: google.cloud.tasks.v2beta3.ITask = {
    name: taskName,
    httpRequest: {
      headers: {
        "Content-Type": "application/json",
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
  try {
    return await client.createTask(request);
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === 6) {
      console.log(
        `Task already exists for user ${userId} step ${step}, skipping`,
      );
      return;
    }
    throw e;
  }
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
  const currentUser = await getUserContact({ userId });

  if (!currentUser) {
    throw new Error("User not found");
  }
  return currentUser;
}

async function sendWorkflowEmail({
  userId,
  step,
  initialRun,
  email,
}: {
  userId: number;
  step: string;
  initialRun: number;
  email: EmailHtml;
}) {
  const key = `workflow:email:${userId}:${step}:${initialRun}`;
  const alreadySent = await redis.exists(key);
  if (alreadySent) {
    console.log(`Email already sent for user ${userId} step ${step}, skipping`);
    return;
  }
  await sendBatchEmailHtml([email]);
  await redis.set(key, 1, { ex: 30 * 86400 });
}

async function getPauseContext(userId: number) {
  const workspace = await getUserWorkspace(userId);
  if (!workspace) return {};
  const monitorCount = await countActiveMonitors({
    workspaceId: workspace.id,
  });
  return {
    monitorCount: monitorCount || undefined,
    workspaceSlug: workspace.slug,
  };
}

async function getUserWorkspace(userId: number) {
  return getFreeWorkspaceOfUser({ userId });
}
