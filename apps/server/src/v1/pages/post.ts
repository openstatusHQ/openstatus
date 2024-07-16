import { createRoute, z } from "@hono/zod-openapi";

import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { monitor, monitorsToPages, page } from "@openstatus/db/src/schema";

import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { isNumberArray } from "../utils";
import type { pagesApi } from "./index";
import { PageSchema } from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["page"],
  description: "Create a status page",
  path: "/",
  request: {
    body: {
      description: "The status page to create",
      content: {
        "application/json": {
          schema: PageSchema.omit({ id: true }),
        },
      },
    },
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

export function registerPostPage(api: typeof pagesApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const limits = c.get("limits");
    const input = c.req.valid("json");

    const count = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(page)
        .where(eq(page.workspaceId, Number(workspaceId)))
        .all()
    )[0].count;

    if (count >= limits["status-pages"]) {
      throw new HTTPException(403, {
        message: "Upgrade for more status pages",
      });
    }

    if (
      limits["password-protection"] === false &&
      input?.passwordProtected === true
    ) {
      throw new HTTPException(403, {
        message: "Upgrade for password protection",
      });
    }

    const countSlug = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(page)
        .where(eq(page.slug, input.slug))
        .all()
    )[0].count;

    if (countSlug > 0) {
      throw new HTTPException(409, {
        message: "Slug has to be unique and has already been taken",
      });
    }

    const { monitors, ...rest } = input;

    if (monitors?.length) {
      const monitorIds = isNumberArray(monitors)
        ? monitors
        : monitors.map((m) => m.monitorId);

      const _monitors = await db
        .select()
        .from(monitor)
        .where(
          and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, Number(workspaceId)),
            isNull(monitor.deletedAt)
          )
        )
        .all();

      if (_monitors.length !== monitors.length) {
        throw new HTTPException(400, { message: "Monitor not found" });
      }
    }

    const _page = await db
      .insert(page)
      .values({
        ...rest,
        workspaceId: Number(workspaceId),
        customDomain: rest.customDomain ?? "", // TODO: make database migration to allow null
      })
      .returning()
      .get();

    // TODO: missing order
    if (monitors?.length) {
      for (const monitor of monitors) {
        const values =
          typeof monitor === "number" ? { monitorId: monitor } : monitor;

        await db
          .insert(monitorsToPages)
          .values({ pageId: _page.id, ...values })
          .run();
      }
    }
    const data = PageSchema.parse(_page);
    return c.json(data, 200);
  });
}
