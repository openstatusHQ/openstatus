import { createRoute } from "@hono/zod-openapi";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import {
  monitor,
  page,
  pageComponent,
  subdomainSafeList,
} from "@openstatus/db/src/schema";
import { isNumberArray } from "../utils";
import type { pagesApi } from "./index";
import { PageSchema, ParamsSchema, transformPageData } from "./schema";

const putRoute = createRoute({
  method: "put",
  tags: ["page"],
  summary: "Update a status page",
  path: "/{id}",
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

    if (
      limits["email-domain-protection"] === false &&
      (input?.accessType === "email-domain" || input?.authEmailDomains?.length)
    ) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for email domain protection",
      });
    }

    if (
      limits["password-protection"] === false &&
      (input?.accessType === "password" || input?.password)
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
        accessType:
          rest.accessType ?? (rest.passwordProtected ? "password" : "public"),
        authEmailDomains: rest.authEmailDomains?.join(","),
        updatedAt: new Date(),
      })
      .where(eq(page.id, _page.id))
      .returning()
      .get();

    // Use pageComponent instead of deprecated monitorsToPages
    const currentPageComponents = await db
      .select()
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, _page.id),
          eq(pageComponent.type, "monitor"),
        ),
      );

    const currentMonitorIds = currentPageComponents
      .map((c) => c.monitorId)
      .filter((id): id is number => id !== null);

    const removedMonitors = currentMonitorIds.filter(
      (x) => !monitorIds?.includes(x),
    );

    if (removedMonitors.length) {
      await db
        .delete(pageComponent)
        .where(
          and(
            inArray(pageComponent.monitorId, removedMonitors),
            eq(pageComponent.pageId, newPage.id),
          ),
        );
    }

    if (monitors) {
      // Fetch all monitors to get their names
      const allMonitorIds = isNumberArray(monitors)
        ? monitors
        : monitors.map((m) => m.monitorId);
      const monitorsData = await db
        .select()
        .from(monitor)
        .where(inArray(monitor.id, allMonitorIds))
        .all();
      const monitorMap = new Map(monitorsData.map((m) => [m.id, m]));

      for (let i = 0; i < monitors.length; i++) {
        const mon = monitors[i];
        const values =
          typeof mon === "number" ? { monitorId: mon } : mon;
        const monitorInfo = monitorMap.get(values.monitorId);

        await db
          .insert(pageComponent)
          .values({
            workspaceId,
            pageId: newPage.id,
            type: "monitor",
            monitorId: values.monitorId,
            name: monitorInfo?.name ?? "",
            order: i,
          })
          .onConflictDoUpdate({
            target: [pageComponent.monitorId, pageComponent.pageId],
            set: { order: sql.raw("excluded.`order`") },
          });
      }
    }

    const data = transformPageData(
      PageSchema.parse({
        ...newPage,
        monitors: monitors || currentPageComponents.map((c) => ({
          monitorId: c.monitorId,
          order: c.order,
        })),
      }),
    );

    return c.json(data, 200);
  });
}
