import { createRoute } from "@hono/zod-openapi";

import { Events } from "@openstatus/analytics";
import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { monitor, monitorsToPages, page } from "@openstatus/db/src/schema";
import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { trackMiddleware } from "../middleware";
import { isNumberArray } from "../utils";
import type { pagesApi } from "./index";
import { PageSchema, ParamsSchema } from "./schema";

const putRoute = createRoute({
  method: "put",
  tags: ["page"],
  description: "Update a status page",
  path: "/:id",
  middleware: [trackMiddleware(Events.UpdatePage)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          // REMINDER: allow only partial updates
          schema: PageSchema.omit({ id: true }).partial(),
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

export function registerPutPage(api: typeof pagesApi) {
  return api.openapi(putRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const limits = c.get("limits");
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    if (input.customDomain && !limits["custom-domain"]) {
      throw new HTTPException(403, {
        message: "Upgrade for custom domains",
      });
    }

    if (input.customDomain?.toLowerCase().includes("openstatus")) {
      throw new HTTPException(400, {
        message: "Domain cannot contain 'openstatus'",
      });
    }

    if (
      limits["password-protection"] === false &&
      input?.passwordProtected === true
    ) {
      throw new HTTPException(403, {
        message: "Forbidden - Upgrade for password protection",
      });
    }

    const _page = await db
      .select()
      .from(page)
      .where(
        and(eq(page.id, Number(id)), eq(page.workspaceId, Number(workspaceId))),
      )
      .get();

    if (!_page) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    if (input.slug && _page.slug !== input.slug) {
      const countSlug = (
        await db
          .select({ count: sql<number>`count(*)` })
          .from(page)
          .where(eq(page.slug, input.slug))
          .all()
      )[0].count;

      if (countSlug > 0) {
        throw new HTTPException(400, {
          message: "Forbidden - Slug already taken",
        });
      }
    }
    const { monitors, ...rest } = input;

    const monitorIds = monitors
      ? isNumberArray(monitors)
        ? monitors
        : monitors.map((m) => m.monitorId)
      : [];

    if (monitors?.length) {
      const monitorsData = await db
        .select()
        .from(monitor)
        .where(
          and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, Number(workspaceId)),
            isNull(monitor.deletedAt),
          ),
        )
        .all();

      if (monitorsData.length !== monitors.length) {
        throw new HTTPException(400, {
          message: "Not Found - Wrong monitor configuration",
        });
      }
    }

    const newPage = await db
      .update(page)
      .set({ ...rest, customDomain: input.customDomain ?? "" })
      .where(eq(page.id, _page.id))
      .returning()
      .get();

    const currentMonitorsToPages = await db
      .select()
      .from(monitorsToPages)
      .where(eq(monitorsToPages.pageId, _page.id));

    const removedMonitors = currentMonitorsToPages
      .map(({ monitorId }) => monitorId)
      .filter((x) => !monitorIds?.includes(x));

    if (removedMonitors.length) {
      await db
        .delete(monitorsToPages)
        .where(
          and(
            inArray(monitorsToPages.monitorId, removedMonitors),
            eq(monitorsToPages.pageId, newPage.id),
          ),
        );
    }

    if (monitors) {
      for (const monitor of monitors) {
        const values =
          typeof monitor === "number" ? { monitorId: monitor } : monitor;

        await db
          .insert(monitorsToPages)
          .values({ pageId: newPage.id, ...values })
          .onConflictDoUpdate({
            target: [monitorsToPages.monitorId, monitorsToPages.pageId],
            set: { order: sql.raw("excluded.`order`") },
          });
      }
    }

    const data = PageSchema.parse(newPage);

    return c.json(data, 200);
  });
}
