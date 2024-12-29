import { createRoute } from "@hono/zod-openapi";
import { eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { workspace } from "@openstatus/db/src/schema/workspaces";
import { HTTPException } from "hono/http-exception";
import type { whoamiApi } from ".";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { WorkspaceSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["whoami"],
  path: "/",
  description: "Get the current workspace information",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: WorkspaceSchema,
        },
      },
      description: "The current workspace information with the limits",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetWhoami(api: typeof whoamiApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspace").id;

    const _workspace = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .get();

    if (!_workspace) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = WorkspaceSchema.parse(_workspace);
    return c.json(data, 200);
  });
}
