import { TRPCError } from "@trpc/server";

import { z } from "zod";
import { monitorFlyRegionSchema } from "@openstatus/db/src/schema/constants";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  headerAssertion,
  textBodyAssertion,
  jsonBodyAssertion,
  statusAssertion,
  deserialize,
} from "@openstatus/assertions";

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
      ])
    )
    .default([]),
});

const tcpTestInput = z.object({
  url: z.string(),
  region: monitorFlyRegionSchema.optional().default("ams"),
});

export const tcpTextOutput = z.object({
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
});

export const httpOutput = z.object({
  type: z.literal("http").default("http"),
  status: z.number(),
  latency: z.number(),
  headers: z.record(z.string()),
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
});

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
            {} as Record<string, string>
          ),
          body: input.body,
        }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      }
    );

    const json = await res.json();
    const result = httpOutput.parse(json);

    const assertions = deserialize(JSON.stringify(input.assertions)).map(
      (assertion) =>
        assertion.assert({
          body: result.body ?? "",
          header: result.headers ?? {},
          status: result.status,
        })
    );

    if (assertions.some((assertion) => !assertion.success)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Assertion error: ${
          assertions.find((assertion) => !assertion.success)?.message
        }`,
      });
    }

    if (result.status < 200 || result.status >= 300) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Assertion error: The response status was not 2XX: ${result.status}.`,
      });
    }

    return result;
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
      }
    );

    const json = await res.json();
    return tcpTextOutput.parse(json);
  } catch (error) {
    console.error("Checker TCP test failed", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "TCP check failed",
    });
  }
}

export const checkerRouter = createTRPCRouter({
  testHttp: protectedProcedure
    .input(httpTestInput)
    .mutation(async ({ input }) => {
      return testHttp(input);
    }),

  testTcp: protectedProcedure
    .input(tcpTestInput)
    .mutation(async ({ input }) => {
      return testTcp(input);
    }),
});
