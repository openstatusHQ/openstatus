import { createRoute, z } from "@hono/zod-openapi";

import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { checkAPI } from "./index";
import { CheckPostResponseSchema, CheckSchema, ResponseSchema } from "./schema";
import { db } from "@openstatus/db";
import { check } from "@openstatus/db/src/schema/check";
import { env } from "../../env";

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

    const { headers, regions, runCount, ...rest } = data;

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

    const allTimings = result
      .filter((r) => r.status === "fulfilled")
      .map((r) => {
        if (r.status === "fulfilled") {
          const data = ResponseSchema.parse(r.value.json());
          return data.timing;
        }
      });

    const lastResponse = ResponseSchema.parse(
      result.filter((r) => r.status === "fulfilled")?.pop()
    );
    const responseResult = CheckPostResponseSchema.parse({
      id: newCheck.id,
      timing: allTimings,
      response: lastResponse,
    });

    return c.json(responseResult);
  });
}
