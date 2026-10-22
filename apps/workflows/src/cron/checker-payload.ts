import type { MonitorStatus } from "@openstatus/db/src/schema";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import type {
  Region,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema/constants";
import {
  type DNSPayloadSchema,
  type grpcPayloadSchema,
  type httpPayloadSchema,
  type icmpPayloadSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";
import { Effect, Result } from "effect";
import type { z } from "zod";

export type Periodicity = z.infer<typeof monitorPeriodicitySchema>;

export type TaskInput = {
  row: z.infer<typeof selectMonitorSchema>;
  timestamp: number;
  status: MonitorStatus;
  region: Region;
};

export type CheckerPayload =
  | z.infer<typeof httpPayloadSchema>
  | z.infer<typeof tpcPayloadSchema>
  | z.infer<typeof DNSPayloadSchema>
  | z.infer<typeof icmpPayloadSchema>
  | z.infer<typeof grpcPayloadSchema>;

// timestamp needs to be in ms
export function buildCheckerPayload({
  row,
  timestamp,
  status,
}: Omit<TaskInput, "region">): CheckerPayload {
  const otelConfig = row.otelEndpoint
    ? {
        endpoint: row.otelEndpoint,
        headers: transformHeaders(row.otelHeaders),
      }
    : undefined;

  switch (row.jobType) {
    case "http":
      return {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        url: row.url,
        method: row.method || "GET",
        cronTimestamp: timestamp,
        body: row.body,
        headers: row.headers,
        status: status,
        assertions: row.assertions ? JSON.parse(row.assertions) : null,
        degradedAfter: row.degradedAfter,
        timeout: row.timeout,
        trigger: "cron",
        otelConfig,
        retry: row.retry || 3,
        followRedirects:
          row.followRedirects === null ? true : row.followRedirects,
      };
    case "tcp":
      return {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        uri: row.url,
        status: status,
        assertions: row.assertions ? JSON.parse(row.assertions) : null,
        cronTimestamp: timestamp,
        degradedAfter: row.degradedAfter,
        timeout: row.timeout,
        trigger: "cron",
        retry: row.retry || 3,
        otelConfig,
      };
    case "dns":
      return {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        uri: row.url,
        cronTimestamp: timestamp,
        status: status,
        assertions: row.assertions ? JSON.parse(row.assertions) : null,
        degradedAfter: row.degradedAfter,
        timeout: row.timeout,
        trigger: "cron",
        otelConfig,
        retry: row.retry || 3,
      };
    case "icmp":
      return {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        uri: row.url,
        cronTimestamp: timestamp,
        status: status,
        degradedAfter: row.degradedAfter,
        timeout: row.timeout,
        trigger: "cron",
        otelConfig,
        retry: row.retry || 3,
      };
    case "grpc":
      return {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        uri: row.url,
        service: row.grpcService ?? undefined,
        tls: row.grpcTls ?? "tls",
        headers: transformHeaders(row.headers),
        cronTimestamp: timestamp,
        status: status,
        degradedAfter: row.degradedAfter,
        timeout: row.timeout,
        trigger: "cron",
        otelConfig,
        retry: row.retry || 3,
      };
    default:
      throw new Error("Invalid jobType");
  }
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
              Buffer.from(JSON.stringify(buildCheckerPayload(input))),
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
