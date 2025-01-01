import { createRoute, type z } from "@hono/zod-openapi";

import { env } from "@/env";
import { openApiErrorResponses } from "@/libs/errors";
import { db } from "@openstatus/db";
import { check } from "@openstatus/db/src/schema/check";
import percentile from "percentile";
import type { checkApi } from "../index";
import {
  AggregatedResponseSchema,
  AggregatedResult,
  CheckPostResponseSchema,
  CheckSchema,
  ResponseSchema,
} from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["check"],
  summary: "Run a single check",
  path: "/http",
  request: {
    body: {
      description: "The run request to create",
      content: {
        "application/json": {
          schema: CheckSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CheckPostResponseSchema,
        },
      },
      description: "Return a run result",
    },
    ...openApiErrorResponses,
  },
});

export function registerHTTPPostCheck(api: typeof checkApi) {
  return api.openapi(postRoute, async (c) => {
    const data = c.req.valid("json");
    const workspaceId = c.get("workspace").id;
    const input = c.req.valid("json");

    const { headers, regions, runCount, aggregated, ...rest } = data;

    const newCheck = await db
      .insert(check)
      .values({
        workspaceId: workspaceId,
        regions: regions.join(","),
        countRequests: runCount,
        ...rest,
      })
      .returning()
      .get();

    const result = [];

    for (let count = 0; count < input.runCount; count++) {
      const currentFetch = [];
      for (const region of input.regions) {
        const r = fetch(`https://openstatus-checker.fly.dev/ping/${region}`, {
          headers: {
            Authorization: `Basic ${env.CRON_SECRET}`,
            "Content-Type": "application/json",
            "fly-prefer-region": region,
          },
          method: "POST",
          body: JSON.stringify({
            requestId: newCheck.id,
            workspaceId: workspaceId,
            url: input.url,
            method: input.method,
            headers: input.headers?.reduce((acc, { key, value }) => {
              if (!key) return acc; // key === "" is an invalid header

              return {
                // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
                ...acc,
                [key]: value,
              };
            }, {}),
            body: input.body ? input.body : undefined,
          }),
        });
        currentFetch.push(r);
      }

      const allResults = await Promise.allSettled(currentFetch);
      result.push(...allResults);
    }

    const fulfilledRequest: z.infer<typeof ResponseSchema>[] = [];

    const filteredResult = result.filter((r) => r.status === "fulfilled");
    for await (const r of filteredResult) {
      if (r.status !== "fulfilled") throw new Error("No value");

      const json = await r.value.json();
      const parsed = ResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.error(parsed.error.errors);
        throw new Error(`Failed to parse response: ${parsed.error.errors}`);
      }

      fulfilledRequest.push(parsed.data);
    }

    let aggregatedResponse = null;

    if (aggregated) {
      const { dns, connect, tls, firstByte, transfer, latency } =
        getTiming(fulfilledRequest);

      aggregatedResponse = AggregatedResult.parse({
        dns: getAggregate(dns),
        connect: getAggregate(connect),
        tls: getAggregate(tls),
        firstByte: getAggregate(firstByte),
        transfer: getAggregate(transfer),
        latency: getAggregate(latency),
      });
    }

    const allTimings = fulfilledRequest.map((r) => r.timing);

    const lastResponse = fulfilledRequest[fulfilledRequest.length - 1];
    const responseResult = CheckPostResponseSchema.parse({
      id: newCheck.id,
      raw: allTimings, // TODO: we should return the region here as well!
      response: lastResponse,
      aggregated: aggregatedResponse ? aggregatedResponse : undefined,
    });

    return c.json(responseResult, 200);
  });
}

// This is a helper function to get the timing of the request

type ReturnGetTiming = Record<
  "dns" | "connect" | "tls" | "firstByte" | "transfer" | "latency",
  number[]
>;

function getTiming(data: z.infer<typeof ResponseSchema>[]): ReturnGetTiming {
  return data.reduce(
    (prev, curr) => {
      prev.dns.push(curr.timing.dnsDone - curr.timing.dnsStart);
      prev.connect.push(curr.timing.connectDone - curr.timing.connectStart);
      prev.tls.push(
        curr.timing.tlsHandshakeDone - curr.timing.tlsHandshakeStart,
      );
      prev.firstByte.push(
        curr.timing.firstByteDone - curr.timing.firstByteStart,
      );
      prev.transfer.push(curr.timing.transferDone - curr.timing.transferStart);
      prev.latency.push(curr.latency);
      return prev;
    },
    {
      dns: [],
      connect: [],
      tls: [],
      firstByte: [],
      transfer: [],
      latency: [],
    } as ReturnGetTiming,
  );
}

function getAggregate(data: number[]) {
  const parsed = AggregatedResponseSchema.safeParse({
    p50: percentile(50, data),
    p75: percentile(75, data),
    p95: percentile(95, data),
    p99: percentile(99, data),
    min: Math.min(...data),
    max: Math.max(...data),
  });

  if (!parsed.success) {
    console.error(parsed.error.errors);
    throw new Error(`Failed to parse response: ${parsed.error.errors}`);
  }

  return parsed.data;
}
