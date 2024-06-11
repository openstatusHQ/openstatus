import { createRoute, z } from "@hono/zod-openapi";

import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { checkAPI } from "./index";
import {
  AggregatedResponseSchema,
  CheckPostResponseSchema,
  CheckSchema,
  ResponseSchema,
} from "./schema";
import { db } from "@openstatus/db";
import { check } from "@openstatus/db/src/schema/check";
import { env } from "../../env";
import percentile from "percentile";

const postRoute = createRoute({
  method: "post",
  tags: ["page"],
  description: "Run a single check",
  path: "/",
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

export function registerPostCheck(api: typeof checkAPI) {
  return api.openapi(postRoute, async (c) => {
    const data = c.req.valid("json");
    const workspaceId = c.get("workspaceId");
    const input = c.req.valid("json");

    const { headers, regions, runCount, aggregated, ...rest } = data;

    const newCheck = await db
      .insert(check)
      .values({
        workspaceId: Number(workspaceId),
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
        const r = fetch(`https://checker.openstatus.dev/ping/${region}`, {
          headers: {
            Authorization: `Basic ${env.CRON_SECRET}`,
            "Content-Type": "application/json",
            "fly-prefer-region": region,
          },
          method: "POST",
          body: JSON.stringify({
            checkId: newCheck.id,
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
    console.log(result);
    const filteredResult = result.filter((r) => r.status === "fulfilled");
    const fulfilledRequest = [];
    for await (const r of filteredResult) {
      if (r.status !== "fulfilled") throw new Error("No value");

      const json = await r.value.json();
      console.log(ResponseSchema.safeParse(json));
      fulfilledRequest.push(ResponseSchema.parse(json));
    }

    let aggregatedResponse = null;
    if (aggregated) {
      // This is ugly
      const dnsArray = fulfilledRequest.map(
        (r) => r.timing.dnsDone - r.timing.dnsStart
      );
      const connectArray = fulfilledRequest.map(
        (r) => r.timing.connectDone - r.timing.connectStart
      );
      const tlsArray = fulfilledRequest.map(
        (r) => r.timing.tlsHandshakeDone - r.timing.tlsHandshakeStart
      );
      const firstArray = fulfilledRequest.map(
        (r) => r.timing.firstByteDone - r.timing.firstByteStart
      );
      const transferArray = fulfilledRequest.map(
        (r) => r.timing.transferDone - r.timing.transferStart
      );
      const latencyArray = fulfilledRequest.map((r) => r.latency);

      const dnsPercentile = percentile([50, 75, 95, 99], dnsArray) as number[];
      const connectPercentile = percentile(
        [50, 75, 95, 99],
        connectArray
      ) as number[];
      const tlsPercentile = percentile([50, 75, 95, 99], tlsArray) as number[];
      const firstPercentile = percentile(
        [50, 75, 95, 99],
        firstArray
      ) as number[];

      const transferPercentile = percentile(
        [50, 75, 95, 99],
        transferArray
      ) as number[];
      const latencyPercentile = percentile(
        [50, 75, 95, 99],
        latencyArray
      ) as number[];

      const aggregate = z.object({
        dms: AggregatedResponseSchema,
        connect: AggregatedResponseSchema,
        tls: AggregatedResponseSchema,
        firstByte: AggregatedResponseSchema,
        transfert: AggregatedResponseSchema,
        latency: AggregatedResponseSchema,
      });
      const aggregatedDNS = AggregatedResponseSchema.parse({
        p50: dnsPercentile[0],
        p75: dnsPercentile[1],
        p95: dnsPercentile[2],
        p99: dnsPercentile[3],
        min: Math.min(...dnsArray),
        max: Math.max(...dnsArray),
      });
      const aggregatedConnect = AggregatedResponseSchema.parse({
        p50: connectPercentile[0],
        p75: connectPercentile[1],
        p95: connectPercentile[2],
        p99: connectPercentile[3],
        min: Math.min(...connectArray),
        max: Math.max(...connectArray),
      });
      const aggregatedTls = AggregatedResponseSchema.parse({
        p50: tlsPercentile[0],
        p75: tlsPercentile[1],
        p95: tlsPercentile[2],
        p99: tlsPercentile[3],
        min: Math.min(...tlsArray),
        max: Math.max(...tlsArray),
      });
      const aggregatedFirst = AggregatedResponseSchema.parse({
        p50: firstPercentile[0],
        p75: firstPercentile[1],
        p95: firstPercentile[2],
        p99: firstPercentile[3],
        min: Math.min(...firstArray),
        max: Math.max(...firstArray),
      });
      const aggregatedTransfer = AggregatedResponseSchema.parse({
        p50: transferPercentile[0],
        p75: transferPercentile[1],
        p95: transferPercentile[2],
        p99: transferPercentile[3],
        min: Math.min(...transferArray),
        max: Math.max(...transferArray),
      });

      const aggregatedLatency = AggregatedResponseSchema.parse({
        p50: latencyPercentile[0],
        p75: latencyPercentile[1],
        p95: latencyPercentile[2],
        p99: latencyPercentile[3],
        min: Math.min(...latencyArray),
        max: Math.max(...latencyArray),
      });

      aggregatedResponse = aggregate.parse({
        dns: aggregatedDNS,
        connection: aggregatedConnect,
        tls: aggregatedTls,
        firstByte: aggregatedFirst,
        transfer: aggregatedTransfer,
        latency: aggregatedLatency,
      });
    }
    const allTimings = fulfilledRequest.map((r) => r.timing);

    const lastResponse = fulfilledRequest[fulfilledRequest.length - 1];
    const responseResult = CheckPostResponseSchema.parse({
      id: newCheck.id,
      raw: allTimings,
      response: lastResponse,
      aggregated: aggregatedResponse,
    });

    return c.json(responseResult);
  });
}
