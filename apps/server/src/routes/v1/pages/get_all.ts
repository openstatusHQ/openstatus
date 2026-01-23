import { createRoute } from "@hono/zod-openapi";

import { openApiErrorResponses } from "@/libs/errors";
import { notEmpty } from "@/utils/not-empty";
import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { pagesApi } from "./index";
import { PageSchema, transformPageData } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["page"],
  summary: "List all status pages",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PageSchema.array(),
        },
      },
      description: "A list of your status pages",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllPages(api: typeof pagesApi) {
  return api.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspace").id;

    const _pages = await db.query.page.findMany({
      where: eq(page.workspaceId, workspaceId),
      with: {
        pageComponents: true,
      },
    });

    const data = PageSchema.array()
      .parse(
        _pages.map((p) => {
          const monitorIds = p.pageComponents
            .map((pc) => pc.monitorId)
            .filter(notEmpty);
          return {
            ...p,
            monitors: monitorIds.length > 0 ? monitorIds : undefined,
          };
        }),
      )
      .map((page) => transformPageData(page));

    return c.json(data, 200);
  });
}
