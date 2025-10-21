import { TRPCError } from "@trpc/server";

import { Events } from "@openstatus/analytics";
import {
  deserialize,
  headerAssertion,
  jsonBodyAssertion,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import { and, db, eq } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";
import { monitorFlyRegionSchema } from "@openstatus/db/src/schema/constants";
import {
  type httpPayloadSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";
import { z } from "zod";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const ABORT_TIMEOUT = 10000;

// Input schemas
const httpTestInput = z.object({
  url: z.string().url(),
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
    .default("GET"),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  body: z.string().optional(),
  region: monitorFlyRegionSchema.optional().default("ams"),
  assertions: z
    .array(
      z.discriminatedUnion("type", [
        statusAssertion,
        headerAssertion,
        textBodyAssertion,
        jsonBodyAssertion,
      ]),
    )
    .default([]),
});

const tcpTestInput = z.object({
  url: z.string(),
  region: monitorFlyRegionSchema.optional().default("ams"),
});

export const tcpTextOutput = z
  .object({
    state: z.literal("success").default("success"),
    type: z.literal("tcp").default("tcp"),
    requestId: z.number().optional(),
    workspaceId: z.number().optional(),
    monitorId: z.number().optional(),
    timestamp: z.number(),
    timing: z.object({
      tcpStart: z.number(),
      tcpDone: z.number(),
    }),
    error: z.string().optional(),
    region: monitorFlyRegionSchema,
    latency: z.number().optional(),
  })
  .or(
    z.object({
      state: z.literal("error").default("error"),
      message: z.string(),
    }),
  );

export const httpOutput = z
  .object({
    state: z.literal("success").default("success"),
    type: z.literal("http").default("http"),
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
    region: monitorFlyRegionSchema,
  })
  .or(
    z.object({
      state: z.literal("error").default("error"),
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
      `https://checker.openstatus.dev/ping/${input.region}`,
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
    console.error("Checker HTTP test failed", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "HTTP check failed",
    });
  }
}

export async function testTcp(input: z.infer<typeof tcpTestInput>) {
  try {
    const res = await fetch(
      `https://checker.openstatus.dev/tcp/${input.region}`,
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
    const result = tcpTextOutput.safeParse(json);

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
    console.error("Checker TCP test failed", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "TCP check failed",
    });
  }
}

export async function triggerChecker(
  input: z.infer<typeof selectMonitorSchema>,
) {
  let payload:
    | z.infer<typeof httpPayloadSchema>
    | z.infer<typeof tpcPayloadSchema>
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
