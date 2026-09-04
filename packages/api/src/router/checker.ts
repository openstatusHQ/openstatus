import { Events } from "@openstatus/analytics";
import {
  deserialize,
  dnsRecords,
  headerAssertion,
  jsonBodyAssertion,
  recordAssertion,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import { and, db, eq } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";
import { monitorRegionSchema } from "@openstatus/db/src/schema/constants";
import {
  type httpPayloadSchema,
  type grpcPayloadSchema,
  type icmpPayloadSchema,
  GRPC_TLS_MODES,
  safeUrlSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const ABORT_TIMEOUT = 10000;

// PingICMP treats its timeout as the deadline for the whole check, so omitting
// it means a deadline of "now": the send loop breaks before the first packet
// and every test reports "no reply". Kept under ABORT_TIMEOUT so the checker
// answers before the fetch above gives up.
const ICMP_TEST_TIMEOUT = 5000;

// Kept under ABORT_TIMEOUT so the checker answers before the fetch gives up.
const GRPC_TEST_TIMEOUT = 5000;

// Unreachable targets, failed assertions and timeouts are expected outcomes
// already surfaced to the user as BAD_REQUEST; only unexpected failures should
// reach the logs (and Sentry).
function toCheckerError(
  error: unknown,
  label: string,
  fallback: string,
): TRPCError {
  if (error instanceof TRPCError) {
    if (error.code !== "BAD_REQUEST") {
      console.error(`Checker ${label} test failed`, error);
    }
    return error;
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: `The ${label} check did not complete within ${
        ABORT_TIMEOUT / 1000
      } seconds. Please try again.`,
    });
  }

  console.error(`Checker ${label} test failed`, error);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

// Input schemas
const httpTestInput = z.object({
  url: safeUrlSchema,
  method: z
    .enum([
      "GET",
      "HEAD",
      "OPTIONS",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "CONNECT",
      "TRACE",
    ])
    .prefault("GET"),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  body: z.string().optional(),
  region: monitorRegionSchema.optional().prefault("ams"),
  assertions: z
    .array(
      z.discriminatedUnion("type", [
        statusAssertion,
        headerAssertion,
        textBodyAssertion,
        jsonBodyAssertion,
        recordAssertion,
      ]),
    )
    .prefault([]),
});

const tcpTestInput = z.object({
  url: z.string(),
  region: monitorRegionSchema.optional().prefault("ams"),
});

const dnsTestInput = z.object({
  url: z.string(),
  region: monitorRegionSchema.optional().prefault("ams"),
  assertions: z
    .array(
      z.discriminatedUnion("type", [
        recordAssertion,
        statusAssertion,
        headerAssertion,
        textBodyAssertion,
        jsonBodyAssertion,
      ]),
    )
    .prefault([]),
});

const icmpTestInput = z.object({
  url: z.string(),
  region: monitorRegionSchema.optional().prefault("ams"),
});

const grpcTestInput = z.object({
  url: z.string(),
  service: z.string().optional(),
  tls: z.enum(GRPC_TLS_MODES).optional().prefault("tls"),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  region: monitorRegionSchema.optional().prefault("ams"),
});

export const grpcOutput = z
  .object({
    state: z.literal("success").prefault("success"),
    type: z.literal("grpc").prefault("grpc"),
    jobType: z.literal("grpc").optional(),
    requestId: z.number().optional(),
    workspaceId: z.number().optional(),
    monitorId: z.number().optional(),
    timestamp: z.number(),
    timing: z.object({
      dnsStart: z.number(),
      dnsDone: z.number(),
      connectStart: z.number(),
      connectDone: z.number(),
      tlsHandshakeStart: z.number(),
      tlsHandshakeDone: z.number(),
      firstByteStart: z.number(),
      firstByteDone: z.number(),
      transferStart: z.number(),
      transferDone: z.number(),
    }),
    latency: z.number().optional(),
    servingStatus: z.string().optional(),
    service: z.string().optional(),
    grpcCode: z.number().optional(),
    completed: z.boolean().optional(),
    errorMessage: z.string().optional(),
    error: z.number().optional(),
    region: monitorRegionSchema,
  })
  .or(
    z.object({
      state: z.literal("error").prefault("error"),
      message: z.string(),
    }),
  );

export const icmpOutput = z
  .object({
    state: z.literal("success").prefault("success"),
    type: z.literal("icmp").prefault("icmp"),
    requestId: z.number().optional(),
    workspaceId: z.number().optional(),
    monitorId: z.number().optional(),
    timestamp: z.number(),
    timing: z.object({
      rtts: z.array(z.number()),
    }),
    latency: z.number().optional(),
    latencyMin: z.number().optional(),
    latencyMax: z.number().optional(),
    packetsSent: z.number().optional(),
    packetsReceived: z.number().optional(),
    error: z.string().optional(),
    region: monitorRegionSchema,
  })
  .or(
    z.object({
      state: z.literal("error").prefault("error"),
      message: z.string(),
    }),
  );

export const tcpOutput = z
  .object({
    state: z.literal("success").prefault("success"),
    type: z.literal("tcp").prefault("tcp"),
    requestId: z.number().optional(),
    workspaceId: z.number().optional(),
    monitorId: z.number().optional(),
    timestamp: z.number(),
    timing: z.object({
      tcpStart: z.number(),
      tcpDone: z.number(),
    }),
    error: z.string().optional(),
    region: monitorRegionSchema,
    latency: z.number().optional(),
  })
  .or(
    z.object({
      state: z.literal("error").prefault("error"),
      message: z.string(),
    }),
  );

export const httpOutput = z
  .object({
    state: z.literal("success").prefault("success"),
    type: z.literal("http").prefault("http"),
    status: z.number(),
    latency: z.number(),
    headers: z.record(z.string(), z.string()),
    timestamp: z.number(),
    timing: z.object({
      dnsStart: z.number(),
      dnsDone: z.number(),
      connectStart: z.number(),
      connectDone: z.number(),
      tlsHandshakeStart: z.number(),
      tlsHandshakeDone: z.number(),
      firstByteStart: z.number(),
      firstByteDone: z.number(),
      transferStart: z.number(),
      transferDone: z.number(),
    }),
    body: z.string().optional().nullable(),
    region: monitorRegionSchema,
  })
  .or(
    z.object({
      state: z.literal("error").prefault("error"),
      message: z.string(),
    }),
  )
  .or(
    // A target the checker could not reach (timeout, DNS, refused): `checker.Http`
    // answers 200 with `error` set and `status`/`headers` omitted.
    z
      .object({ error: z.string().min(1), timestamp: z.number() })
      .transform(({ error }) => ({ state: "error" as const, message: error })),
  );

export const dnsOutput = z
  .object({
    state: z.literal("success").prefault("success"),
    type: z.literal("dns").prefault("dns"),
    records: z
      .partialRecord(z.enum(dnsRecords), z.array(z.string()))
      .prefault({}),
    latency: z.number().optional(),
    timestamp: z.number(),
    region: monitorRegionSchema,
  })
  .or(
    z.object({
      state: z.literal("error").prefault("error"),
      message: z.string(),
    }),
  );

export async function testHttp(input: z.infer<typeof httpTestInput>) {
  // Reject requests to our own domain to avoid loops
  if (input.url.includes("openstatus.dev")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Self-requests are not allowed",
    });
  }

  try {
    const res = await fetch(
      `https://openstatus-checker.fly.dev/ping/${input.region}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
          "fly-prefer-region": input.region,
        },
        body: JSON.stringify({
          url: input.url,
          method: input.method,
          headers: input.headers?.reduce(
            (acc, { key, value }) => {
              if (!key) return acc;
              return { ...acc, [key]: value };
            },
            {} as Record<string, string>,
          ),
          body: input.body,
        }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      },
    );

    const json = await res.json();
    const result = httpOutput.safeParse(json);

    if (!result.success) {
      console.error(
        `Checker HTTP test failed for ${input.url}:`,
        result.error.message,
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Checker response is not valid. Please try again. If the problem persists, please contact support.",
      });
    }

    if (result.data.state === "error") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.data.message,
      });
    }

    if (result.data.state === "success") {
      const { body, headers, status } = result.data;

      const assertions = deserialize(JSON.stringify(input.assertions)).map(
        (assertion) =>
          assertion.assert({
            body: body ?? "",
            header: headers ?? {},
            status: status,
          }),
      );

      if (assertions.some((assertion) => !assertion.success)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Assertion error: ${
            assertions.find((assertion) => !assertion.success)?.message
          }`,
        });
      }

      if (assertions.length === 0 && (status < 200 || status >= 300)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Assertion error: The response status was not 2XX: ${status}.`,
        });
      }
    }

    return result.data;
  } catch (error) {
    throw toCheckerError(
      error,
      "HTTP",
      error instanceof Error ? error.message : "HTTP check failed",
    );
  }
}

export async function testTcp(input: z.infer<typeof tcpTestInput>) {
  try {
    const res = await fetch(
      `https://openstatus-checker.fly.dev/tcp/${input.region}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
          "fly-prefer-region": input.region,
        },
        body: JSON.stringify({ uri: input.url }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      },
    );

    const json = await res.json();
    const result = tcpOutput.safeParse(json);

    if (!result.success) {
      console.error(
        `Checker TCP test failed for ${input.url}:`,
        result.error.message,
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Checker response is not valid. Please try again. If the problem persists, please contact support. ${result.error.message}`,
      });
    }

    if (result.data.state === "error") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.data.message,
      });
    }

    return result.data;
  } catch (error) {
    throw toCheckerError(error, "TCP", "TCP check failed");
  }
}

export async function testDns(input: z.infer<typeof dnsTestInput>) {
  try {
    const res = await fetch(
      `https://openstatus-checker.fly.dev/dns/${input.region}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
          "fly-prefer-region": input.region,
        },
        body: JSON.stringify({
          uri: input.url,
        }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      },
    );

    const json = await res.json();
    const result = dnsOutput.safeParse(json);

    if (!result.success) {
      console.error(
        `Checker DNS test failed for ${input.url}:`,
        result.error.message,
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Checker response is not valid. Please try again. If the problem persists, please contact support. ${result.error.message}`,
      });
    }

    if (result.data.state === "error") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.data.message,
      });
    }

    if (result.data.state === "success") {
      const { records } = result.data;

      const assertions = deserialize(JSON.stringify(input.assertions)).map(
        (assertion) => assertion.assert({ records }),
      );

      if (assertions.some((assertion) => !assertion.success)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Assertion error: ${
            assertions.find((assertion) => !assertion.success)?.message
          }`,
        });
      }
    }

    return result.data;
  } catch (error) {
    throw toCheckerError(error, "DNS", "DNS check failed");
  }
}

export async function testIcmp(input: z.infer<typeof icmpTestInput>) {
  try {
    const res = await fetch(
      `https://openstatus-checker.fly.dev/icmp/${input.region}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
          "fly-prefer-region": input.region,
        },
        body: JSON.stringify({
          uri: input.url,
          timeout: ICMP_TEST_TIMEOUT,
        }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      },
    );

    const json = await res.json();
    const result = icmpOutput.safeParse(json);

    if (!result.success) {
      console.error(
        `Checker ICMP test failed for ${input.url}:`,
        result.error.message,
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Checker response is not valid. Please try again. If the problem persists, please contact support. ${result.error.message}`,
      });
    }

    if (result.data.state === "error") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.data.message,
      });
    }

    return result.data;
  } catch (error) {
    throw toCheckerError(error, "ICMP", "ICMP check failed");
  }
}

export async function testGrpc(input: z.infer<typeof grpcTestInput>) {
  try {
    const res = await fetch(
      `https://openstatus-checker.fly.dev/grpc/${input.region}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
          "fly-prefer-region": input.region,
        },
        body: JSON.stringify({
          uri: input.url,
          service: input.service,
          tls: input.tls,
          headers: transformHeaders(input.headers ?? []),
          timeout: GRPC_TEST_TIMEOUT,
        }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      },
    );

    const json = await res.json();
    const result = grpcOutput.safeParse(json);

    if (!result.success) {
      console.error(
        `Checker gRPC test failed for ${input.url}:`,
        result.error.message,
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Checker response is not valid. Please try again. If the problem persists, please contact support. ${result.error.message}`,
      });
    }

    if (result.data.state === "error") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.data.message,
      });
    }

    // Only a transport failure comes back as `state: "error"`. An RPC that
    // completed but answered NOT_SERVING / SERVICE_UNKNOWN — or a server with no
    // health service at all — returns the full response, where `state` is absent
    // and prefaults to "success". `error` is omitempty, so it is present only
    // when the check failed. Mirrors testHttp rejecting a non-2XX status: the
    // target is reachable, but saving it would create a monitor that is already
    // down.
    if (result.data.error === 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          result.data.errorMessage ||
          `The health check did not report SERVING${
            result.data.servingStatus ? `: ${result.data.servingStatus}` : ""
          }`,
      });
    }

    return result.data;
  } catch (error) {
    throw toCheckerError(error, "gRPC", "gRPC check failed");
  }
}

export async function triggerChecker(
  input: z.infer<typeof selectMonitorSchema>,
) {
  let payload:
    | z.infer<typeof httpPayloadSchema>
    | z.infer<typeof tpcPayloadSchema>
    | z.infer<typeof icmpPayloadSchema>
    | z.infer<typeof grpcPayloadSchema>
    | null = null;

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const timestamp = Date.now();

  if (input.jobType === "http") {
    payload = {
      workspaceId: String(input.workspaceId),
      monitorId: String(input.id),
      url: input.url,
      method: input.method || "GET",
      cronTimestamp: timestamp,
      body: input.body,
      headers: input.headers,
      status: "active",
      assertions: input.assertions ? JSON.parse(input.assertions) : null,
      degradedAfter: input.degradedAfter,
      timeout: input.timeout,
      trigger: "cron",
      otelConfig: input.otelEndpoint
        ? {
            endpoint: input.otelEndpoint,
            headers: transformHeaders(input.otelHeaders),
          }
        : undefined,
      retry: input.retry || 3,
      followRedirects: input.followRedirects || true,
    };
  }
  if (input.jobType === "tcp") {
    payload = {
      workspaceId: String(input.workspaceId),
      monitorId: String(input.id),
      uri: input.url,
      status: "active",
      assertions: input.assertions ? JSON.parse(input.assertions) : null,
      cronTimestamp: timestamp,
      degradedAfter: input.degradedAfter,
      timeout: input.timeout,
      trigger: "cron",
      retry: input.retry || 3,
      otelConfig: input.otelEndpoint
        ? {
            endpoint: input.otelEndpoint,
            headers: transformHeaders(input.otelHeaders),
          }
        : undefined,
      followRedirects: input.followRedirects || true,
    };
  }
  if (input.jobType === "dns") {
    payload = {
      workspaceId: String(input.workspaceId),
      monitorId: String(input.id),
      uri: input.url,
      status: "active",
      assertions: input.assertions ? JSON.parse(input.assertions) : null,
      cronTimestamp: timestamp,
      degradedAfter: input.degradedAfter,
      timeout: input.timeout,
      trigger: "cron",
      retry: input.retry || 3,
      otelConfig: input.otelEndpoint
        ? {
            endpoint: input.otelEndpoint,
            headers: transformHeaders(input.otelHeaders),
          }
        : undefined,
      followRedirects: input.followRedirects || true,
    };
  }
  if (input.jobType === "icmp") {
    payload = {
      workspaceId: String(input.workspaceId),
      monitorId: String(input.id),
      uri: input.url,
      status: "active",
      cronTimestamp: timestamp,
      degradedAfter: input.degradedAfter,
      timeout: input.timeout,
      trigger: "cron",
      retry: input.retry || 3,
      otelConfig: input.otelEndpoint
        ? {
            endpoint: input.otelEndpoint,
            headers: transformHeaders(input.otelHeaders),
          }
        : undefined,
    };
  }
  if (input.jobType === "grpc") {
    payload = {
      workspaceId: String(input.workspaceId),
      monitorId: String(input.id),
      uri: input.url,
      service: input.grpcService ?? undefined,
      tls: input.grpcTls ?? "tls",
      headers: transformHeaders(input.headers),
      status: "active",
      cronTimestamp: timestamp,
      degradedAfter: input.degradedAfter,
      timeout: input.timeout,
      trigger: "cron",
      retry: input.retry || 3,
      otelConfig: input.otelEndpoint
        ? {
            endpoint: input.otelEndpoint,
            headers: transformHeaders(input.otelHeaders),
          }
        : undefined,
    };
  }
  const allResult = [];

  for (const region of input.regions) {
    const res = fetch(generateUrl({ row: input }), {
      method: "POST",
      headers: {
        Authorization: `Basic ${env.CRON_SECRET}`,
        "Content-Type": "application/json",
        "fly-prefer-region": region,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ABORT_TIMEOUT),
    });
    allResult.push(res);
  }

  await Promise.allSettled(allResult);
}

function generateUrl({ row }: { row: z.infer<typeof selectMonitorSchema> }) {
  switch (row.jobType) {
    case "http":
      return `https://openstatus-checker.fly.dev/checker/http?monitor_id=${row.id}`;
    case "tcp":
      return `https://openstatus-checker.fly.dev/checker/tcp?monitor_id=${row.id}`;
    case "dns":
      return `https://openstatus-checker.fly.dev/checker/dns?monitor_id=${row.id}`;
    case "icmp":
      return `https://openstatus-checker.fly.dev/checker/icmp?monitor_id=${row.id}`;
    case "grpc":
      return `https://openstatus-checker.fly.dev/checker/grpc?monitor_id=${row.id}`;
    default:
      throw new Error("Invalid jobType");
  }
}

export const checkerRouter = createTRPCRouter({
  testHttp: protectedProcedure
    .meta({ track: Events.TestMonitor })
    .input(httpTestInput)
    .mutation(async ({ input }) => {
      return testHttp(input);
    }),

  testTcp: protectedProcedure
    .meta({ track: Events.TestMonitor })
    .input(tcpTestInput)
    .mutation(async ({ input }) => {
      return testTcp(input);
    }),
  testDns: protectedProcedure
    .meta({ track: Events.TestMonitor })
    .input(dnsTestInput)
    .mutation(async ({ input }) => {
      return testDns(input);
    }),
  testIcmp: protectedProcedure
    .meta({ track: Events.TestMonitor })
    .input(icmpTestInput)
    .mutation(async ({ input }) => {
      return testIcmp(input);
    }),

  testGrpc: protectedProcedure
    .meta({ track: Events.TestMonitor })
    .input(grpcTestInput)
    .mutation(async ({ input }) => {
      return testGrpc(input);
    }),

  triggerChecker: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const m = await db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!m) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found",
        });
      }
      const input = selectMonitorSchema.parse(m);

      return await triggerChecker(input);
    }),
});
