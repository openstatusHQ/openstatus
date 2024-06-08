import { createRoute, z } from "@hono/zod-openapi";

import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { runAPI } from "./index";
import { RunSchema } from "./schema";

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
          schema: RunSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
      description: "Return a run result",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostRun(api: typeof runAPI) {
  return api.openapi(postRoute, async (c) => {
    const data = c.req.valid("json");
    // const workspaceId = c.get("workspaceId");
    // const { id } = c.req.valid("param");
    // const _page = await db
    //   .select()
    //   .from(page)
    //   .where(
    //     and(eq(page.workspaceId, Number(workspaceId)), eq(page.id, Number(id))),
    //   )
    //   .get();
    // if (!_page) {
    //   throw new HTTPException(404, { message: "Not Found" });
    // }
    // const data = PageSchema.parse(_page);
    return c.json(data);
  });
}
