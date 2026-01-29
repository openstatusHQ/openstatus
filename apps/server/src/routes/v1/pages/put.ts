import { createRoute } from "@hono/zod-openapi";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import {
  and,
  eq,
  inArray,
  isNull,
  sql,
  syncPageComponentToMonitorsToPageDelete,
  syncPageComponentToMonitorsToPageInsertMany,
} from "@openstatus/db";
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

    // Query current pageComponents instead of monitorsToPages
    const currentPageComponents = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, _page.id))
      .all();

    const currentMonitorIds = currentPageComponents
      .filter((pc) => pc.type === "monitor" && pc.monitorId !== null)
      .map((pc) => pc.monitorId as number);

    const removedMonitorIds = currentMonitorIds.filter(
      (id) => !monitorIds?.includes(id),
    );

    // Delete removed monitors from pageComponent (primary table)
    if (removedMonitorIds.length) {
      await db
        .delete(pageComponent)
        .where(
          and(
            inArray(pageComponent.monitorId, removedMonitorIds),
            eq(pageComponent.pageId, newPage.id),
          ),
        );
      // Reverse sync delete to monitorsToPages (for backwards compatibility)
      for (const monitorId of removedMonitorIds) {
        await syncPageComponentToMonitorsToPageDelete(db, {
          monitorId,
          pageId: newPage.id,
        });
      }
    }

    // Insert or update pageComponents (primary table)
    if (monitors) {
      for (const [index, m] of monitors.entries()) {
        const values = typeof m === "number" ? { monitorId: m } : m;

        const _monitor = await db.query.monitor.findFirst({
          where: and(
            eq(monitor.id, values.monitorId),
            eq(monitor.workspaceId, workspaceId),
            isNull(monitor.deletedAt),
          ),
        });

        if (!_monitor) {
          throw new OpenStatusApiError({
            code: "BAD_REQUEST",
            message: `Monitor ${values.monitorId} not found`,
          });
        }

        // Insert or update pageComponent
        await db
          .insert(pageComponent)
          .values({
            workspaceId: newPage.workspaceId,
            pageId: newPage.id,
            type: "monitor",
            monitorId: values.monitorId,
            name: _monitor.externalName || _monitor.name,
            order: "order" in values ? values.order : index,
            groupId: null,
            groupOrder: 0,
          })
          .onConflictDoUpdate({
            target: [pageComponent.monitorId, pageComponent.pageId],
            set: {
              order: sql.raw("excluded.`order`"),
              name: sql.raw("excluded.`name`"),
            },
          })
          .run();
      }

      // Reverse sync to monitorsToPages (for backwards compatibility)
      const monitorsToPageValues = monitors.map((m, index) => {
        const values = typeof m === "number" ? { monitorId: m } : m;
        return {
          pageId: newPage.id,
          monitorId: values.monitorId,
          order: "order" in values ? values.order : index,
          monitorGroupId: null,
          groupOrder: 0,
        };
      });

      await syncPageComponentToMonitorsToPageInsertMany(
        db,
        monitorsToPageValues,
      );
    }

    const data = transformPageData(
      PageSchema.parse({
        ...newPage,
        monitors: monitors || currentPageComponents.map((pc) => pc.monitorId),
      }),
    );

    return c.json(data, 200);
  });
}
