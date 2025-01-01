import { createRoute } from "@hono/zod-openapi";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import {
  monitor,
  monitorsToPages,
  page,
  subdomainSafeList,
} from "@openstatus/db/src/schema";
import { isNumberArray } from "../utils";
import type { pagesApi } from "./index";
import { PageSchema, ParamsSchema } from "./schema";

const putRoute = createRoute({
  method: "put",
  tags: ["page"],
  summary: "Update a status page",
  path: "/:id",
  middleware: [trackMiddleware(Events.UpdatePage)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
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
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    if (input.customDomain && !limits["custom-domain"]) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for custom domain",
      });
    }

    if (input.customDomain?.toLowerCase().includes("openstatus")) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "Domain cannot contain 'openstatus'",
      });
    }

    if (
      limits["password-protection"] === false &&
      input?.passwordProtected === true
    ) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for password protection",
      });
    }

    const _page = await db
      .select()
      .from(page)
      .where(and(eq(page.id, Number(id)), eq(page.workspaceId, workspaceId)))
      .get();

    if (!_page) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Page ${id} not found`,
      });
    }

    if (input.slug && _page.slug !== input.slug) {
      if (subdomainSafeList.includes(input.slug)) {
        throw new OpenStatusApiError({
          code: "BAD_REQUEST",
          message: "Slug is reserved",
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
        throw new OpenStatusApiError({
          code: "CONFLICT",
          message: "Slug has to be unique and has already been taken",
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
            eq(monitor.workspaceId, workspaceId),
            isNull(monitor.deletedAt),
          ),
        )
        .all();

      if (monitorsData.length !== monitors.length) {
        throw new OpenStatusApiError({
          code: "BAD_REQUEST",
          message: `Some of the monitors ${monitorIds.join(", ")} not found`,
        });
      }
    }

    const newPage = await db
      .update(page)
      .set({
        ...rest,
        customDomain: input.customDomain ?? "",
        updatedAt: new Date(),
      })
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

    const data = PageSchema.parse({
      ...newPage,
      monitors: monitors || currentMonitorsToPages,
    });

    return c.json(data, 200);
  });
}
