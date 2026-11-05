import { createRoute } from "@hono/zod-openapi";
import { eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import {
  type SettableScope,
  apiKeySettableScopes,
} from "@openstatus/db/src/schema/api-keys/constants";
import { workspace } from "@openstatus/db/src/schema/workspaces";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";

import type { whoamiApi } from ".";
import { WorkspaceSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["whoami"],
  path: "/",
  summary: "Get your information",
  description: "Get the current workspace information attached to the API key.",
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
    const apiKey = c.get("apiKey");

    const _workspace = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .get();

    if (!_workspace) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Workspace ${workspaceId} not found`,
      });
    }

    // `'*'` is never exposed, and the schema enum would reject it.
    const publicScopes = apiKey.scopes.filter((s): s is SettableScope =>
      (apiKeySettableScopes as readonly string[]).includes(s),
    );

    const data = WorkspaceSchema.parse({
      ..._workspace,
      actor: {
        type: "apiKey",
        keyId: apiKey.id,
        scopes: publicScopes,
      },
    });
    return c.json(data, 200);
  });
}
