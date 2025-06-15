import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  type SQL,
  sql,
} from "@openstatus/db";
import {
  incidentTable,
  insertPageSchema,
  maintenance,
  monitor,
  monitorsToPages,
  page,
  selectMaintenanceSchema,
  selectMonitorSchema,
  selectPageSchema,
  selectPageSchemaWithMonitorsRelation,
  selectPublicPageSchemaWithRelation,
  statusReport,
  subdomainSafeList,
  workspace,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const pageRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreatePage, trackProps: ["slug"] })
    .input(insertPageSchema)
    .mutation(async (opts) => {
      const { monitors, workspaceId, id, ...pageProps } = opts.input;

      const monitorIds = monitors?.map((item) => item.monitorId) || [];

      const pageNumbers = (
        await opts.ctx.db.query.page.findMany({
          where: eq(page.workspaceId, opts.ctx.workspace.id),
        })
      ).length;

      const limit = opts.ctx.workspace.limits;

      // the user has reached the status page number limits
      if (pageNumbers >= limit["status-pages"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your status-page limits.",
        });
      }

      // the user is not eligible for password protection
      if (
        limit["password-protection"] === false &&
        opts.input.passwordProtected === true
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Password protection is not available for your current plan.",
        });
      }

      const newPage = await opts.ctx.db
        .insert(page)
        .values({ workspaceId: opts.ctx.workspace.id, ...pageProps })
        .returning()
        .get();

      if (monitorIds.length) {
        // We should make sure the user has access to the monitors
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt)
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }

        const values = monitors.map(({ monitorId }, index) => ({
          pageId: newPage.id,
          order: index,
          monitorId,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      return newPage;
    }),
  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const firstPage = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.id),
          eq(page.workspaceId, opts.ctx.workspace.id)
        ),
        with: {
          monitorsToPages: {
            with: { monitor: true },
            orderBy: (monitorsToPages, { asc }) => [asc(monitorsToPages.order)],
          },
        },
      });
      return selectPageSchemaWithMonitorsRelation.parse(firstPage);
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(insertPageSchema)
    .mutation(async (opts) => {
      const { monitors, ...pageInput } = opts.input;
      if (!pageInput.id) return;

      const monitorIds = monitors?.map((item) => item.monitorId) || [];

      const limit = opts.ctx.workspace.limits;

      // the user is not eligible for password protection
      if (
        limit["password-protection"] === false &&
        opts.input.passwordProtected === true
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Password protection is not available for your current plan.",
        });
      }

      const currentPage = await opts.ctx.db
        .update(page)
        .set({ ...pageInput, updatedAt: new Date() })
        .where(
          and(
            eq(page.id, pageInput.id),
            eq(page.workspaceId, opts.ctx.workspace.id)
          )
        )
        .returning()
        .get();

      if (monitorIds.length) {
        // We should make sure the user has access to the monitors
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt)
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }
      }

      // TODO: check for monitor order!
      const currentMonitorsToPages = await opts.ctx.db
        .select()
        .from(monitorsToPages)
        .where(eq(monitorsToPages.pageId, currentPage.id))
        .all();

      const removedMonitors = currentMonitorsToPages
        .map(({ monitorId }) => monitorId)
        .filter((x) => !monitorIds?.includes(x));

      if (removedMonitors.length) {
        await opts.ctx.db
          .delete(monitorsToPages)
          .where(
            and(
              inArray(monitorsToPages.monitorId, removedMonitors),
              eq(monitorsToPages.pageId, currentPage.id)
            )
          );
      }

      const values = monitors.map(({ monitorId }, index) => ({
        pageId: currentPage.id,
        order: index,
        monitorId,
      }));

      if (values.length) {
        await opts.ctx.db
          .insert(monitorsToPages)
          .values(values)
          .onConflictDoUpdate({
            target: [monitorsToPages.monitorId, monitorsToPages.pageId],
            set: { order: sql.raw("excluded.`order`") },
          });
      }
    }),
  delete: protectedProcedure
    .meta({ track: Events.DeletePage })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.id, opts.input.id),
        eq(page.workspaceId, opts.ctx.workspace.id),
      ];

      await opts.ctx.db
        .delete(page)
        .where(and(...whereConditions))
        .run();
    }),

  getPagesByWorkspace: protectedProcedure.query(async (opts) => {
    const allPages = await opts.ctx.db.query.page.findMany({
      where: and(eq(page.workspaceId, opts.ctx.workspace.id)),
      with: {
        monitorsToPages: { with: { monitor: true } },
        maintenancesToPages: {
          where: and(
            lte(maintenance.from, new Date()),
            gte(maintenance.to, new Date())
          ),
        },
        statusReports: {
          orderBy: (reports, { desc }) => desc(reports.updatedAt),
          with: {
            statusReportUpdates: {
              orderBy: (updates, { desc }) => desc(updates.date),
            },
          },
        },
      },
    });
    console.log(allPages.map((page) => page.statusReports));
    return z.array(selectPageSchemaWithMonitorsRelation).parse(allPages);
  }),

  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .output(selectPublicPageSchemaWithRelation.optional())
    .query(async (opts) => {
      if (!opts.input.slug) return;

      const result = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`
        )
        .get();

      if (!result) {
        return;
      }

      const [workspaceResult, monitorsToPagesResult] = await Promise.all([
        opts.ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, result.workspaceId))
          .get(),
        opts.ctx.db
          .select()
          .from(monitorsToPages)
          .leftJoin(monitor, eq(monitorsToPages.monitorId, monitor.id))
          .where(
            // make sur only active monitors are returned!
            and(eq(monitorsToPages.pageId, result.id), eq(monitor.active, true))
          )
          .all(),
      ]);

      // FIXME: There is probably a better way to do this

      const monitorsId = monitorsToPagesResult.map(
        ({ monitors_to_pages }) => monitors_to_pages.monitorId
      );

      const statusReports = await opts.ctx.db.query.statusReport.findMany({
        where: eq(statusReport.pageId, result.id),
        with: {
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
          },
          monitorsToStatusReports: { with: { monitor: true } },
        },
      });

      const monitorQuery =
        monitorsId.length > 0
          ? opts.ctx.db
              .select()
              .from(monitor)
              .where(
                and(
                  inArray(monitor.id, monitorsId),
                  eq(monitor.active, true),
                  isNull(monitor.deletedAt)
                ) // REMINDER: this is hardcoded
              )
              .all()
          : [];

      const maintenancesQuery = opts.ctx.db.query.maintenance.findMany({
        where: eq(maintenance.pageId, result.id),
        with: { maintenancesToMonitors: true },
        orderBy: (maintenances, { desc }) => desc(maintenances.from),
      });

      const incidentsQuery =
        monitorsId.length > 0
          ? await opts.ctx.db
              .select()
              .from(incidentTable)
              .where(inArray(incidentTable.monitorId, monitorsId))
              .all()
          : [];
      // TODO: monitorsToPagesResult has the result already, no need to query again
      const [monitors, maintenances, incidents] = await Promise.all([
        monitorQuery,
        maintenancesQuery,
        incidentsQuery,
      ]);

      return selectPublicPageSchemaWithRelation.parse({
        ...result,
        // TODO: improve performance and move into SQLite query
        monitors: monitors.sort((a, b) => {
          const aIndex =
            monitorsToPagesResult.find((m) => m.monitor?.id === a.id)
              ?.monitors_to_pages.order || 0;
          const bIndex =
            monitorsToPagesResult.find((m) => m.monitor?.id === b.id)
              ?.monitors_to_pages.order || 0;
          return aIndex - bIndex;
        }),
        incidents,
        statusReports,
        maintenances: maintenances.map((m) => ({
          ...m,
          monitors: m.maintenancesToMonitors.map((m) => m.monitorId),
        })),
        workspacePlan: workspaceResult?.plan,
      });
    }),

  getSlugUniqueness: protectedProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async (opts) => {
      // had filter on some words we want to keep for us
      if (subdomainSafeList.includes(opts.input.slug)) {
        return false;
      }
      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });
      return !(result?.length > 0);
    }),

  addCustomDomain: protectedProcedure
    .input(
      z.object({ customDomain: z.string().toLowerCase(), pageId: z.number() })
    )
    .mutation(async (opts) => {
      // TODO Add some check ?
      await opts.ctx.db
        .update(page)
        .set({ customDomain: opts.input.customDomain })
        .where(eq(page.id, opts.input.pageId))
        .returning()
        .get();
    }),

  isPageLimitReached: protectedProcedure.query(async (opts) => {
    const pageLimit = opts.ctx.workspace.limits["status-pages"];
    const pageNumbers = (
      await opts.ctx.db.query.page.findMany({
        where: eq(monitor.workspaceId, opts.ctx.workspace.id),
      })
    ).length;

    return pageNumbers >= pageLimit;
  }),

  // DASHBOARD

  list: protectedProcedure
    .input(
      z
        .object({
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional()
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
      ];

      const query = opts.ctx.db
        .select()
        .from(page)
        .where(and(...whereConditions));

      if (opts.input?.order === "asc") {
        query.orderBy(asc(page.createdAt));
      } else {
        query.orderBy(desc(page.createdAt));
      }

      const result = await query.all();

      return result;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      const data = await opts.ctx.db.query.page.findFirst({
        where: and(...whereConditions),
        with: {
          monitorsToPages: { with: { monitor: true } },
          maintenancesToPages: true,
        },
      });

      return selectPageSchema
        .extend({
          monitors: z
            .array(selectMonitorSchema.extend({ order: z.number().default(0) }))
            .default([]),
          maintenances: z.array(selectMaintenanceSchema).default([]),
        })
        .parse({
          ...data,
          monitors: data?.monitorsToPages.map((m) => ({
            ...m.monitor,
            order: m.order,
          })),
          maintenances: data?.maintenancesToPages,
        });
    }),

  // TODO: rename to create
  new: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        slug: z.string().toLowerCase(),
        icon: z.string().nullish(),
        description: z.string().nullish(),
      })
    )
    .mutation(async (opts) => {
      const pageNumbers = (
        await opts.ctx.db.query.page.findMany({
          where: eq(page.workspaceId, opts.ctx.workspace.id),
        })
      ).length;

      const limit = opts.ctx.workspace.limits;

      // the user has reached the status page number limits
      if (pageNumbers >= limit["status-pages"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your status-page limits.",
        });
      }

      // had filter on some words we want to keep for us
      if (subdomainSafeList.includes(opts.input.slug)) {
        return false;
      }
      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });

      if (result?.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This slug is already taken. Please choose another one.",
        });
      }

      const newPage = await opts.ctx.db
        .insert(page)
        .values({
          workspaceId: opts.ctx.workspace.id,
          title: opts.input.title,
          slug: opts.input.slug,
          description: opts.input.description ?? "",
          icon: opts.input.icon ?? "",
          customDomain: "", // TODO: make nullable
        })
        .returning()
        .get();

      return newPage;
    }),

  updateGeneral: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
        slug: z.string().toLowerCase(),
        description: z.string().nullish(),
        icon: z.string().nullish(),
      })
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      // had filter on some words we want to keep for us
      if (subdomainSafeList.includes(opts.input.slug)) {
        return false;
      }
      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });

      if (result?.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This slug is already taken. Please choose another one.",
        });
      }

      await opts.ctx.db
        .update(page)
        .set({
          title: opts.input.title,
          slug: opts.input.slug,
          description: opts.input.description ?? "",
          icon: opts.input.icon ?? "",
        })
        .where(and(...whereConditions))
        .run();
    }),

  updatePasswordProtection: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        passwordProtected: z.boolean(),
        password: z.string().nullish(),
      })
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      const limit = opts.ctx.workspace.limits;

      // the user is not eligible for password protection
      if (
        limit["password-protection"] === false &&
        opts.input.passwordProtected === true
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Password protection is not available for your current plan.",
        });
      }

      await opts.ctx.db
        .update(page)
        .set({
          passwordProtected: opts.input.passwordProtected,
          password: opts.input.password,
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateMonitors: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        monitors: z.array(z.object({ id: z.number(), order: z.number() })),
      })
    )
    .mutation(async (opts) => {
      // check if the monitors are in the workspace
      const monitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          inArray(
            monitor.id,
            opts.input.monitors.map((m) => m.id)
          ),
          eq(monitor.workspaceId, opts.ctx.workspace.id)
        ),
      });

      if (monitors.length !== opts.input.monitors.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to all the monitors.",
        });
      }

      await opts.ctx.db.transaction(async (tx) => {
        await tx
          .delete(monitorsToPages)
          .where(eq(monitorsToPages.pageId, opts.input.id));

        await tx.insert(monitorsToPages).values(
          opts.input.monitors.map((m) => ({
            pageId: opts.input.id,
            monitorId: m.id,
            order: m.order,
          }))
        );
      });
    }),
});
