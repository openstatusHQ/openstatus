import { createRoute, z } from "@hono/zod-openapi";

import type { pagesApi } from "./index";
import { PageSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { HTTPException } from "hono/http-exception";

const getAllRoute = createRoute({
  method: "get",
  tags: ["page"],
  description: "Get all your status page",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(PageSchema),
        },
      },
      description: "Get an Status page",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllPages(api: typeof pagesApi) {
  return api.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspaceId");

    const _pages = await db
      .select()
      .from(page)
      .where(eq(page.workspaceId, Number(workspaceId)));

    if (!_pages) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = z.array(PageSchema).parse(_pages);

    return c.json(data);
  });
}
