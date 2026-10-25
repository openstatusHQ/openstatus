import type { MonitorStatus } from "@openstatus/db/src/schema";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import type {
  Region,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema/constants";
import { type CheckerPayload, buildCheckerPayload } from "@openstatus/utils";
import { Effect, Result } from "effect";
import type { z } from "zod";

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
