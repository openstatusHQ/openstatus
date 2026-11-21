import { getLogger } from "@logtape/logtape";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import type {
  Region,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema/constants";
import { regionDict } from "@openstatus/regions";
import { type CheckerPayload, buildCheckerPayload } from "@openstatus/utils";
import { Effect, Result } from "effect";
import type { z } from "zod";

const logger = getLogger("workflow");

export type Periodicity = z.infer<typeof monitorPeriodicitySchema>;

export type TaskInput = {
  row: z.infer<typeof selectMonitorSchema>;
  timestamp: number;
  status: MonitorStatus;
  region: Region;
};

// timestamp needs to be in ms
export function buildCronCheckerPayload({
  row,
  timestamp,
  status,
}: Omit<TaskInput, "region">): CheckerPayload {
  return buildCheckerPayload({
    monitor: row,
    status,
    trigger: "cron",
    timestamp,
  });
}

/**
 * One task per monitor and region, carrying that region's last known status.
 * 30s monitors get a second task half a minute later, the scheduler ticks per minute.
 */
export function buildTaskInputs(args: {
  monitors: TaskInput["row"][];
  statusesByMonitor: Map<number, { region: string; status: MonitorStatus }[]>;
  periodicity: Periodicity;
  timestamp: number;
}): TaskInput[] {
  const { monitors, statusesByMonitor, periodicity, timestamp } = args;
  const inputs: TaskInput[] = [];
  for (const row of monitors) {
    const statuses = statusesByMonitor.get(row.id) ?? [];
    for (const region of row.regions) {
      const info = regionDict[region as keyof typeof regionDict];
      if (!info) {
        logger.error(`Invalid region ${region}`);
        continue;
      }
      if (info.deprecated) {
        logger.error(`Deprecated region ${region}`);
        continue;
      }
      const status =
        statuses.find((s) => s.region === region)?.status || "active";
      inputs.push({ row, timestamp, status, region });
      if (periodicity === "30s") {
        inputs.push({ row, timestamp: timestamp + 30_000, status, region });
      }
    }
  }
  return inputs;
}

export function checkerTopic(region: Region, periodicity: Periodicity) {
  return periodicity === "30s" ? `checker-${region}-30s` : `checker-${region}`;
}

export type CheckerPublisher = {
  publish: (
    topic: string,
    data: Buffer,
    attributes: Record<string, string>,
  ) => Promise<string>;
};

export type PublishResult = {
  success: number;
  failed: number;
  failedByRegion: Partial<Record<Region, number>>;
  errors: string[];
};

export async function publishCheckerTasks(
  inputs: TaskInput[],
  periodicity: Periodicity,
  publisher: CheckerPublisher,
): Promise<PublishResult> {
  const results = await Effect.runPromise(
    Effect.forEach(
      inputs,
      (input) =>
        Effect.tryPromise({
          try: () =>
            publisher.publish(
              checkerTopic(input.region, periodicity),
              Buffer.from(JSON.stringify(buildCronCheckerPayload(input))),
              {
                jobType: input.row.jobType,
                periodicity,
                monitorId: String(input.row.id),
                region: input.region,
              },
            ),
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
          // No retry here, unlike the Cloud Tasks path: there a retried task
          // dedupes on its name (ALREADY_EXISTS), but every publishMessage is
          // a new message. The client already retries the batch RPC itself, so
          // a rejection here is final and counts as a missed check.
        }).pipe(Effect.result),
      // Unbounded so every publish lands in the client's batch window at once;
      // the Pub/Sub client does the batching, not us.
      { concurrency: "unbounded" },
    ),
  );

  const result: PublishResult = {
    success: 0,
    failed: 0,
    failedByRegion: {},
    errors: [],
  };
  results.forEach((outcome, i) => {
    if (Result.isSuccess(outcome)) {
      result.success++;
      return;
    }
    const region = inputs[i].region;
    result.failed++;
    result.failedByRegion[region] = (result.failedByRegion[region] ?? 0) + 1;
    result.errors.push(outcome.failure.message);
  });

  return result;
}
