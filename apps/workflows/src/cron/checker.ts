import { PubSub, type Topic } from "@google-cloud/pubsub";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos";
import { getLogger } from "@logtape/logtape";
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
} from "@openstatus/db";
import {
  maintenance,
  monitor,
  monitorStatusTable,
  selectMonitorSchema,
  selectMonitorStatusSchema,
} from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import {
  maintenancesToPageComponents,
  pageComponent,
} from "@openstatus/db/src/schema/page_components";
import { regionDict } from "@openstatus/regions";
import { Effect, Result, Schedule } from "effect";
import { z } from "zod";

import { env } from "../env";
import { db } from "../lib/db";
import {
  type CheckerPublisher,
  type Periodicity,
  type TaskInput,
  buildCronCheckerPayload,
  publishCheckerTasks,
} from "./checker-payload";

export const isAuthorizedDomain = (url: string) => {
  return url.includes(env().SITE_URL);
};

const logger = getLogger("workflow");

/**
 * Check if GCP Cloud Tasks is properly configured.
 * Returns false if credentials are missing or set to placeholder values.
 */
function isGcpConfigured(): boolean {
  const projectId = env().GCP_PROJECT_ID;
  const location = env().GCP_LOCATION;
  const clientEmail = env().GCP_CLIENT_EMAIL;
  const privateKey = env().GCP_PRIVATE_KEY;

  return (
    projectId !== "" &&
    projectId !== "your-value" &&
    location !== "" &&
    location !== "your-value" &&
    clientEmail !== "" &&
    clientEmail !== "your-value" &&
    privateKey !== "" &&
    privateKey !== "your-value"
  );
}

// Only initialize CloudTasksClient if GCP credentials are properly configured
// This allows self-hosted deployments to run without GCP Cloud Tasks
let client: CloudTasksClient | null = null;
let publisher: CheckerPublisher | null = null;

if (isGcpConfigured()) {
  const options = {
    projectId: env().GCP_PROJECT_ID,
    credentials: {
      client_email: env().GCP_CLIENT_EMAIL,
      private_key: env().GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
    },
  };
  client = new CloudTasksClient(options);
  publisher = createPublisher(new PubSub(options));
}

function createPublisher(pubsub: PubSub): CheckerPublisher {
  const topics = new Map<string, Topic>();
  return {
    publish: (name, data, attributes) => {
      let topic = topics.get(name);
      if (!topic) {
        topic = pubsub.topic(name, {
          batching: { maxMessages: 1000, maxMilliseconds: 10 },
        });
        topics.set(name, topic);
      }
      return topic.publishMessage({ data, attributes });
    },
  };
}

export async function sendCheckerTasks(
  periodicity: Periodicity,
): Promise<{ success: number; failed: number }> {
  // If GCP is not configured, skip task creation
  if (!client || !publisher) {
    logger.warn("GCP Cloud Tasks not configured - skipping checker tasks", {
      periodicity,
    });
    return { success: 0, failed: 0 };
  }

  const timestamp = Date.now();

  const currentMaintenance = db
    .select({ id: maintenance.id })
    .from(maintenance)
    .where(
      and(lte(maintenance.from, new Date()), gte(maintenance.to, new Date())),
    )
    .as("currentMaintenance");

  const currentMaintenanceMonitors = db
    .select({ id: pageComponent.monitorId })
    .from(maintenancesToPageComponents)
    .innerJoin(
      currentMaintenance,
      eq(maintenancesToPageComponents.maintenanceId, currentMaintenance.id),
    )
    .innerJoin(
      pageComponent,
      eq(maintenancesToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(isNotNull(pageComponent.monitorId));

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

  logger.info("Starting cron job", {
    periodicity,
    monitor_count: result.length,
  });

  const monitors = z.array(selectMonitorSchema).safeParse(result);
  const taskInputs: TaskInput[] = [];
  if (!monitors.success) {
    logger.error(`Error while fetching the monitors ${monitors.error}`);
    throw new Error("Error while fetching the monitors");
  }

  if (monitors.data.length === 0) {
    logger.info("No monitors to check", { periodicity });
    return { success: 0, failed: 0 };
  }

  // Batch fetch all monitor statuses in a single query (N+1 fix)
  const monitorIds = monitors.data.map((m) => m.id);
  const rawStatuses = await db
    .select()
    .from(monitorStatusTable)
    .where(inArray(monitorStatusTable.monitorId, monitorIds))
    .all();

  const statusMap = new Map<
    number,
    z.infer<typeof selectMonitorStatusSchema>[]
  >();
  for (const raw of rawStatuses) {
    const parsed = selectMonitorStatusSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error("Failed to parse monitor status row", {
        monitor_id: raw.monitorId,
        error_message: parsed.error.message,
      });
      continue;
    }
    const list = statusMap.get(raw.monitorId) ?? [];
    list.push(parsed.data);
    statusMap.set(raw.monitorId, list);
  }

  for (const row of monitors.data) {
    const monitorStatuses = statusMap.get(row.id) ?? [];

    for (const region of row.regions) {
      const status =
        monitorStatuses.find((m) => region === m.region)?.status || "active";

      const r = regionDict[region as keyof typeof regionDict];

      if (!r) {
        logger.error(`Invalid region ${region}`);
        continue;
      }
      if (r.deprecated) {
        // Let's uncomment this when we are ready to remove deprecated regions
        // We should not use deprecated regions anymore
        logger.error(`Deprecated region ${region}`);
        continue;
      }
      taskInputs.push({ row, timestamp, status, region });
      if (periodicity === "30s") {
        const scheduledAt = timestamp + 30 * 1000;
        taskInputs.push({
          row,
          timestamp: scheduledAt,
          status,
          region,
        });
      }
    }
  }

  const transport = env().CHECKER_TRANSPORT;
  const { success, failed } =
    transport === "pubsub"
      ? await publishToPubSub(taskInputs, periodicity, publisher)
      : await createCloudTasks(taskInputs, periodicity, client);

  logger.info("Completed cron job", {
    periodicity,
    transport,
    total_tasks: taskInputs.length,
    success_count: success,
    failed_count: failed,
    duration_ms: Date.now() - timestamp,
  });
  if (failed > 0) {
    logger.error("Cron job had failures", {
      periodicity,
      transport,
      failed_count: failed,
      success_count: success,
    });
  }

  return { success, failed };
}

async function publishToPubSub(
  taskInputs: TaskInput[],
  periodicity: Periodicity,
  publisher: CheckerPublisher,
) {
  const result = await publishCheckerTasks(taskInputs, periodicity, publisher);
  if (result.failed > 0) {
    logger.error("Pub/Sub publish failed", {
      periodicity,
      failed_by_region: result.failedByRegion,
      error_message: result.errors[0],
    });
  }
  return result;
}

async function createCloudTasks(
  taskInputs: TaskInput[],
  periodicity: Periodicity,
  client: CloudTasksClient,
) {
  const parent = client.queuePath(
    env().GCP_PROJECT_ID,
    env().GCP_LOCATION,
    periodicity,
  );

  const results = await Effect.runPromise(
    Effect.forEach(
      taskInputs,
      (input) =>
        Effect.tryPromise({
          try: () => createCronTask(input, parent, client),
          catch: (err) => {
            if (err instanceof Error && "code" in err && err.code === 6) {
              return "ALREADY_EXISTS" as const;
            }
            return new Error(
              `Failed creating task for monitor ${input.row.id} in region ${input.region}`,
            );
          },
        }).pipe(
          Effect.catchIf(
            (err): err is "ALREADY_EXISTS" => err === "ALREADY_EXISTS",
            () => Effect.void,
          ),
          Effect.retry({
            times: 3,
            schedule: Schedule.exponential("1000 millis"),
          }),
          Effect.result,
        ),
      { concurrency: 100 },
    ),
  );

  for (const result of results) {
    if (Result.isFailure(result)) {
      logger.error("Task creation failed after retries", {
        error_message: result.failure.message,
      });
    }
  }

  return {
    success: results.filter(Result.isSuccess).length,
    failed: results.filter(Result.isFailure).length,
  };
}

const createCronTask = async (
  { row, timestamp, status, region }: TaskInput,
  parent: string,
  client: CloudTasksClient,
) => {
  const payload = buildCronCheckerPayload({ row, timestamp, status });
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
  const taskName = `${parent}/tasks/monitor-${row.id}-${region}-${timestamp}`;
  const newTask: google.cloud.tasks.v2beta3.ITask = {
    name: taskName,
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
    // The checker answers only after its whole retry loop, which a 5m timeout
    // can stretch well past Cloud Tasks' 10m default; 30m is the max allowed.
    dispatchDeadline: { seconds: 30 * 60 },
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
