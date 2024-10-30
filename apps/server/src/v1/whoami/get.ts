import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { workspace } from "@openstatus/db/src/schema/workspaces";
import { HTTPException } from "hono/http-exception";
import type { whoamiApi } from ".";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { schema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["whoami"],
  path: "/",
  description: "Get the current workspace information",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schema,
        },
      },
      description: "The current workspace information with the limits",
    },
    ...openApiErrorResponses,
  },
}); // Error: createRoute is not defined

export function registerGetWhoami(api: typeof whoamiApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspaceId");

    const workspaceData = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, Number(workspaceId)))
      .get();

    if (!workspaceData) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = schema.parse(workspaceData);
    return c.json(data, 200);
  });
}
