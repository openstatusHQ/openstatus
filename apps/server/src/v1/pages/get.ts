import { createRoute, z } from "@hono/zod-openapi";

import { and, eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page } from "@openstatus/db/src/schema";
import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { pagesApi } from "./index";
import { PageSchema, ParamsSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["page"],
  description: "Get a status page",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PageSchema,
        },
      },
      description: "Get an Status page",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetPage(api: typeof pagesApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

    const _page = await db
      .select()
      .from(page)
      .where(
        and(eq(page.workspaceId, Number(workspaceId)), eq(page.id, Number(id)))
      )
      .get();

    if (!_page) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = PageSchema.parse(_page);

    return c.json(data, 200);
  });
}
