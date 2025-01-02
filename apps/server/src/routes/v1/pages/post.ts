import { createRoute, z } from "@hono/zod-openapi";

import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import {
  monitor,
  monitorsToPages,
  page,
  subdomainSafeList,
} from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import { isNumberArray } from "../utils";
import type { pagesApi } from "./index";
import { PageSchema } from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["page"],
  summary: "Create a status page",
  path: "/",
  middleware: [trackMiddleware(Events.CreatePage, ["slug"])],
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
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;
    const input = c.req.valid("json");

    if (input.customDomain && !limits["custom-domain"]) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for custom domains",
      });
    }

    if (input.customDomain?.toLowerCase().includes("openstatus")) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "Domain cannot contain 'openstatus'",
      });
    }

    const count = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(page)
        .where(eq(page.workspaceId, workspaceId))
        .all()
    )[0].count;

    if (count >= limits["status-pages"]) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for more status pages",
      });
    }

    if (
      !limits["password-protection"] &&
      (input?.passwordProtected || input?.password)
    ) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for password protection",
      });
    }

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
        code: "BAD_REQUEST",
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
            eq(monitor.workspaceId, workspaceId),
            isNull(monitor.deletedAt),
          ),
        )
        .all();

      if (_monitors.length !== monitors.length) {
        throw new OpenStatusApiError({
          code: "BAD_REQUEST",
          message: `Some of the monitors ${monitorIds.join(", ")} not found`,
        });
      }
    }

    const _page = await db
      .insert(page)
      .values({
        ...rest,
        workspaceId: workspaceId,
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
