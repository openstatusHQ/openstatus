import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { and, db, eq, inArray, isNull } from "@openstatus/db";
import { monitor, page } from "@openstatus/db/src/schema";
import { maintenance } from "@openstatus/db/src/schema/maintenances";
import {
  maintenancesToPageComponents,
  pageComponent,
} from "@openstatus/db/src/schema/page_components";
import { dispatchMaintenanceUpdate } from "@openstatus/subscriptions";
import type { maintenancesApi } from "./index";
import { MaintenanceSchema } from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["maintenance"],
  summary: "Create a maintenance",
  path: "/",
  middleware: [trackMiddleware(Events.CreateMaintenance)],
  request: {
    body: {
      content: {
        "application/json": {
          schema: MaintenanceSchema.omit({ id: true }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MaintenanceSchema,
        },
      },
      description: "Create a maintenance",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostMaintenance(api: typeof maintenancesApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const input = c.req.valid("json");
    const limits = c.get("workspace").limits;

    const { monitorIds, pageId } = input;

    if (input.from > input.to) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "`date.from` cannot be after `date.to`",
      });
    }

    const _newMaintenance = await db.transaction(async (tx) => {
      const _monitors = await tx
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

      if (_monitors.length !== monitorIds.length) {
        throw new OpenStatusApiError({
          code: "BAD_REQUEST",
          message: `Some of the monitors ${monitorIds.join(", ")} not found`,
        });
      }

      const _page = await tx
        .select()
        .from(page)
        .where(and(eq(page.id, pageId), eq(page.workspaceId, workspaceId)))
        .get();

      if (!_page) {
        throw new OpenStatusApiError({
          code: "BAD_REQUEST",
          message: `Page ${pageId} not found`,
        });
      }

      const newMaintenance = await tx
        .insert(maintenance)
        .values({
          ...input,
          workspaceId,
        })
        .returning()
        .get();

      if (monitorIds?.length && newMaintenance.pageId) {
        // Get page components for the given monitors and page
        const pageComponents = await tx
          .select({ id: pageComponent.id })
          .from(pageComponent)
          .where(
            and(
              inArray(pageComponent.monitorId, monitorIds),
              eq(pageComponent.pageId, newMaintenance.pageId),
            ),
          )
          .all();

        if (pageComponents.length > 0) {
          // Insert to maintenancesToPageComponents
          await tx
            .insert(maintenancesToPageComponents)
            .values(
              pageComponents.map((pc) => ({
                maintenanceId: newMaintenance.id,
                pageComponentId: pc.id,
              })),
            )
            .run();
        }
      }

      return newMaintenance;
    });

    if (limits["status-subscribers"] && _newMaintenance.pageId) {
      await dispatchMaintenanceUpdate(_newMaintenance.id);
    }

    const data = MaintenanceSchema.parse({
      ..._newMaintenance,
      monitorIds: input.monitorIds,
    });

    return c.json(data, 200);
  });
}
