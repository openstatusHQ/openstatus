import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  type SQL,
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from "@openstatus/db";
import {
  incidentTable,
  insertPageSchema,
  legacy_selectPublicPageSchemaWithRelation,
  maintenance,
  monitor,
  monitorsToPages,
  page,
  pageAccessTypes,
  pageComponent,
  pageGroup,
  selectMaintenanceSchema,
  selectMonitorSchema,
  selectPageGroupSchema,
  selectPageSchema,
  selectPageSchemaWithMonitorsRelation,
  statusReport,
  subdomainSafeList,
  workspace,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

if (process.env.NODE_ENV === "test") {
  require("../test/preload");
}

// Helper functions to reuse Vercel API logic
async function addDomainToVercel(domain: string) {
  const data = await fetch(
    `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains?teamId=${env.TEAM_ID_VERCEL}`,
    {
      body: JSON.stringify({ name: domain }),
      headers: {
        Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  return data.json();
}

async function removeDomainFromVercel(domain: string) {
  const data = await fetch(
    `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
      },
      method: "DELETE",
    },
  );
  return data.json();
}

export const pageRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreatePage, trackProps: ["slug"] })
    .input(insertPageSchema)
    .mutation(async (opts) => {
      const { monitors, workspaceId, id, configuration, ...pageProps } =
        opts.input;

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
        .values({
          workspaceId: opts.ctx.workspace.id,
          configuration: JSON.stringify(configuration),
          ...pageProps,
          authEmailDomains: pageProps.authEmailDomains?.join(","),
        })
        .returning()
        .get();

      if (monitorIds.length) {
        // We should make sure the user has access to the monitors
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }

        // Create a map for quick monitor lookup
        const monitorMap = new Map(allMonitors.map((m) => [m.id, m]));

        const values = monitors.map(({ monitorId }, index) => {
          const mon = monitorMap.get(monitorId);
          return {
            workspaceId: opts.ctx.workspace.id,
            pageId: newPage.id,
            type: "monitor" as const,
            monitorId,
            name: mon?.name ?? "",
            order: index,
          };
        });

        await opts.ctx.db.insert(pageComponent).values(values).run();
      }

      return newPage;
    }),
  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const firstPage = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.id),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          pageComponents: {
            with: { monitor: true },
            orderBy: (pageComponents, { asc }) => [asc(pageComponents.order)],
          },
        },
      });
      // Transform pageComponents to monitorsToPages format for backward compat
      const transformed = firstPage
        ? {
            ...firstPage,
            monitorsToPages: firstPage.pageComponents
              .filter((c) => c.type === "monitor" && c.monitor)
              .map((c) => ({
                pageId: c.pageId,
                monitorId: c.monitorId!,
                order: c.order ?? 0,
                monitor: c.monitor,
              })),
          }
        : firstPage;
      return selectPageSchemaWithMonitorsRelation.parse(transformed);
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
        .set({
          ...pageInput,
          updatedAt: new Date(),
          authEmailDomains: pageInput.authEmailDomains?.join(","),
        })
        .where(
          and(
            eq(page.id, pageInput.id),
            eq(page.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      // Fetch all monitors if there are any to validate
      let allMonitors: Awaited<ReturnType<typeof opts.ctx.db.query.monitor.findMany>> = [];
      if (monitorIds.length) {
        // We should make sure the user has access to the monitors
        allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }
      }

      // Get current page components
      const currentPageComponents = await opts.ctx.db
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, currentPage.id),
            eq(pageComponent.type, "monitor"),
          ),
        )
        .all();

      const currentMonitorIds = currentPageComponents
        .map((c) => c.monitorId)
        .filter((id): id is number => id !== null);

      const removedMonitorIds = currentMonitorIds.filter(
        (x) => !monitorIds?.includes(x),
      );

      if (removedMonitorIds.length) {
        await opts.ctx.db
          .delete(pageComponent)
          .where(
            and(
              inArray(pageComponent.monitorId, removedMonitorIds),
              eq(pageComponent.pageId, currentPage.id),
            ),
          );
      }

      // Create a map for quick monitor lookup
      const monitorMap = new Map(allMonitors.map((m) => [m.id, m]));

      const values = monitors.map(({ monitorId }, index) => {
        const mon = monitorMap.get(monitorId);
        return {
          workspaceId: opts.ctx.workspace.id,
          pageId: currentPage.id,
          type: "monitor" as const,
          monitorId,
          name: mon?.name ?? "",
          order: index,
        };
      });

      if (values.length) {
        await opts.ctx.db
          .insert(pageComponent)
          .values(values)
          .onConflictDoUpdate({
            target: [pageComponent.monitorId, pageComponent.pageId],
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
        pageComponents: { with: { monitor: true } },
        maintenances: {
          where: and(
            lte(maintenance.from, new Date()),
            gte(maintenance.to, new Date()),
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
    // Transform pageComponents to monitorsToPages format for backward compat
    const transformed = allPages.map((p) => ({
      ...p,
      monitorsToPages: p.pageComponents
        .filter((c) => c.type === "monitor" && c.monitor)
        .map((c) => ({
          pageId: c.pageId,
          monitorId: c.monitorId!,
          order: c.order ?? 0,
          monitor: c.monitor,
        })),
    }));
    return z.array(selectPageSchemaWithMonitorsRelation).parse(transformed);
  }),

  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .output(legacy_selectPublicPageSchemaWithRelation.nullish())
    .query(async (opts) => {
      if (!opts.input.slug) return;

      const result = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        )
        .get();

      if (!result) return;

      const [workspaceResult, pageComponentsResult] = await Promise.all([
        opts.ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, result.workspaceId))
          .get(),
        opts.ctx.db
          .select()
          .from(pageComponent)
          .leftJoin(monitor, eq(pageComponent.monitorId, monitor.id))
          .where(
            // make sure only active monitors are returned!
            and(
              eq(pageComponent.pageId, result.id),
              eq(pageComponent.type, "monitor"),
              eq(monitor.active, true),
            ),
          )
          .all(),
      ]);

      const monitorsId = pageComponentsResult
        .map(({ page_component }) => page_component.monitorId)
        .filter((id): id is number => id !== null);

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
                  isNull(monitor.deletedAt),
                ), // REMINDER: this is hardcoded
              )
              .all()
          : [];

      const maintenancesQuery = opts.ctx.db.query.maintenance.findMany({
        where: eq(maintenance.pageId, result.id),
        with: { maintenancesToMonitors: { with: { monitor: true } } },
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
      // TODO: pageComponentsResult has the result already, no need to query again
      const [monitors, maintenances, incidents] = await Promise.all([
        monitorQuery,
        maintenancesQuery,
        incidentsQuery,
      ]);

      return legacy_selectPublicPageSchemaWithRelation.parse({
        ...result,
        // TODO: improve performance and move into SQLite query
        monitors: monitors.sort((a, b) => {
          const aIndex =
            pageComponentsResult.find((c) => c.monitor?.id === a.id)
              ?.page_component.order || 0;
          const bIndex =
            pageComponentsResult.find((c) => c.monitor?.id === b.id)
              ?.page_component.order || 0;
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
      z.object({ customDomain: z.string().toLowerCase(), pageId: z.number() }),
    )
    .mutation(async (opts) => {
      if (opts.input.customDomain.toLowerCase().includes("openstatus")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Domain cannot contain 'openstatus'",
        });
      }

      // TODO Add some check ?
      await opts.ctx.db
        .update(page)
        .set({ customDomain: opts.input.customDomain, updatedAt: new Date() })
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
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
      ];

      const result = await opts.ctx.db.query.page.findMany({
        where: and(...whereConditions),
        with: {
          statusReports: true,
        },
        orderBy: (pages, { asc }) => [
          opts.input?.order === "asc"
            ? asc(pages.createdAt)
            : desc(pages.createdAt),
        ],
      });

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
          pageComponents: { with: { monitor: true, group: true } },
          maintenances: true,
        },
      });

      return selectPageSchema
        .extend({
          monitors: z
            .array(
              selectMonitorSchema.extend({
                order: z.number().prefault(0),
                groupOrder: z.number().prefault(0),
                groupId: z.number().nullable(),
              }),
            )
            .prefault([]),
          monitorGroups: z.array(selectPageGroupSchema).prefault([]),
          maintenances: z.array(selectMaintenanceSchema).prefault([]),
        })
        .parse({
          ...data,
          monitors: data?.pageComponents
            .filter((c) => c.type === "monitor" && c.monitor)
            .map((c) => ({
              ...c.monitor,
              order: c.order,
              groupId: c.groupId,
              groupOrder: c.groupOrder,
            })),
          monitorGroups: Array.from(
            new Map(
              data?.pageComponents
                .filter((c) => c.group)
                .map((c) => [c.group?.id, c.group]),
            ).values(),
          ),
          maintenances: data?.maintenances,
        });
    }),

  // TODO: rename to create
  new: protectedProcedure
    .meta({ track: Events.CreatePage, trackProps: ["slug"] })
    .input(
      z.object({
        title: z.string(),
        slug: z.string().toLowerCase(),
        icon: z.string().nullish(),
        description: z.string().nullish(),
      }),
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

      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });

      if (subdomainSafeList.includes(opts.input.slug) || result?.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This slug is already taken. Please choose another one.",
        });
      }

      // REMINDER: default config from legacy page
      const defaultConfiguration = {
        type: "absolute",
        value: "requests",
        uptime: true,
        theme: "default-rounded",
      } satisfies Record<string, string | boolean | undefined>;

      const newPage = await opts.ctx.db
        .insert(page)
        .values({
          workspaceId: opts.ctx.workspace.id,
          title: opts.input.title,
          slug: opts.input.slug,
          description: opts.input.description ?? "",
          icon: opts.input.icon ?? "",
          legacyPage: false,
          configuration: defaultConfiguration,
          customDomain: "", // TODO: make nullable
        })
        .returning()
        .get();

      return newPage;
    }),

  updateGeneral: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
        slug: z.string().toLowerCase(),
        description: z.string().nullish(),
        icon: z.string().nullish(),
      }),
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });

      const oldSlug = await opts.ctx.db.query.page.findFirst({
        where: and(...whereConditions),
      });

      if (
        subdomainSafeList.includes(opts.input.slug) ||
        (oldSlug?.slug !== opts.input.slug && result?.length > 0)
      ) {
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
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateCustomDomain: protectedProcedure
    .meta({ track: Events.UpdatePageDomain, trackProps: ["customDomain"] })
    .input(z.object({ id: z.number(), customDomain: z.string().toLowerCase() }))
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      if (opts.input.customDomain.includes("openstatus")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Domain cannot contain 'openstatus'",
        });
      }

      // Get the current page to check the existing custom domain
      const currentPage = await opts.ctx.db.query.page.findFirst({
        where: and(...whereConditions),
      });

      if (!currentPage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      const oldDomain = currentPage.customDomain;
      const newDomain = opts.input.customDomain;

      try {
        // Handle domain changes
        if (newDomain && !oldDomain) {
          // Adding a new domain
          await opts.ctx.db
            .update(page)
            .set({ customDomain: newDomain, updatedAt: new Date() })
            .where(and(...whereConditions))
            .run();

          // Add domain to Vercel using the domain router logic
          await addDomainToVercel(newDomain);
        } else if (oldDomain && newDomain !== oldDomain) {
          // Changing domain - remove old and add new
          await opts.ctx.db
            .update(page)
            .set({ customDomain: newDomain, updatedAt: new Date() })
            .where(and(...whereConditions))
            .run();

          // Remove old domain from Vercel
          await removeDomainFromVercel(oldDomain);

          // Add new domain to Vercel
          if (newDomain) {
            await addDomainToVercel(newDomain);
          }
        } else if (oldDomain && newDomain === "") {
          // Removing domain
          await opts.ctx.db
            .update(page)
            .set({ customDomain: "", updatedAt: new Date() })
            .where(and(...whereConditions))
            .run();

          // Remove domain from Vercel
          await removeDomainFromVercel(oldDomain);
        } else {
          // No change needed, just update the database
          await opts.ctx.db
            .update(page)
            .set({ customDomain: newDomain, updatedAt: new Date() })
            .where(and(...whereConditions))
            .run();
        }
      } catch (error) {
        // If Vercel operations fail, we should rollback the database change
        // For now, we'll just throw the error
        console.error("Error updating custom domain:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update custom domain",
        });
      }
    }),

  updatePasswordProtection: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z.object({
        id: z.number(),
        accessType: z.enum(pageAccessTypes),
        authEmailDomains: z.array(z.string()).nullish(),
        password: z.string().nullish(),
      }),
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
        opts.input.accessType === "password"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Password protection is not available for your current plan.",
        });
      }

      if (
        limit["email-domain-protection"] === false &&
        opts.input.accessType === "email-domain"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Email domain protection is not available for your current plan.",
        });
      }

      await opts.ctx.db
        .update(page)
        .set({
          accessType: opts.input.accessType,
          authEmailDomains: opts.input.authEmailDomains?.join(","),
          password: opts.input.password,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateAppearance: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z.object({
        id: z.number(),
        forceTheme: z.enum(["light", "dark", "system"]),
        configuration: z.object({
          theme: z.string(),
        }),
      }),
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(...whereConditions),
      });

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      const currentConfiguration =
        (typeof _page.configuration === "object" &&
          _page.configuration !== null &&
          _page.configuration) ||
        {};
      const updatedConfiguration = {
        ...currentConfiguration,
        theme: opts.input.configuration.theme,
      };

      await opts.ctx.db
        .update(page)
        .set({
          forceTheme: opts.input.forceTheme,
          configuration: updatedConfiguration,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateLinks: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z.object({
        id: z.number(),
        homepageUrl: z.string().nullish(),
        contactUrl: z.string().nullish(),
      }),
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      await opts.ctx.db
        .update(page)
        .set({
          homepageUrl: opts.input.homepageUrl,
          contactUrl: opts.input.contactUrl,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updatePageConfiguration: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z.object({
        id: z.number(),
        configuration: z
          .record(z.string(), z.string().or(z.boolean()).optional())
          .nullish(),
      }),
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(...whereConditions),
      });

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      const currentConfiguration =
        (typeof _page.configuration === "object" &&
          _page.configuration !== null &&
          _page.configuration) ||
        {};
      const updatedConfiguration = {
        ...currentConfiguration,
        ...opts.input.configuration,
      };

      await opts.ctx.db
        .update(page)
        .set({
          configuration: updatedConfiguration,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateMonitors: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z.object({
        id: z.number(),
        monitors: z.array(z.object({ id: z.number(), order: z.number() })),
        groups: z.array(
          z.object({
            // id: z.number(), // we dont need it as we are deleting and adding
            order: z.number(),
            name: z.string(),
            monitors: z.array(z.object({ id: z.number(), order: z.number() })),
          }),
        ),
      }),
    )
    .mutation(async (opts) => {
      const monitorIds = opts.input.monitors.map((m) => m.id);
      const groupMonitorIds = opts.input.groups.flatMap((g) =>
        g.monitors.map((m) => m.id),
      );

      const allMonitorIds = [...new Set([...monitorIds, ...groupMonitorIds])];
      // check if the monitors are in the workspace
      const monitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          inArray(monitor.id, allMonitorIds),
          eq(monitor.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (monitors.length !== allMonitorIds.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to all the monitors.",
        });
      }

      // Create a map for quick monitor lookup
      const monitorMap = new Map(monitors.map((m) => [m.id, m]));

      await opts.ctx.db.transaction(async (tx) => {
        // Delete page components (only monitor types) first to avoid foreign key constraint violation
        await tx
          .delete(pageComponent)
          .where(
            and(
              eq(pageComponent.pageId, opts.input.id),
              eq(pageComponent.type, "monitor"),
            ),
          );
        await tx.delete(pageGroup).where(eq(pageGroup.pageId, opts.input.id));

        if (opts.input.groups.length > 0) {
          const pageGroups = await tx
            .insert(pageGroup)
            .values(
              opts.input.groups.map((g) => ({
                workspaceId: opts.ctx.workspace.id,
                pageId: opts.input.id,
                name: g.name,
              })),
            )
            .returning();

          await tx.insert(pageComponent).values(
            opts.input.groups.flatMap((g, i) =>
              g.monitors.map((m) => {
                const mon = monitorMap.get(m.id);
                return {
                  workspaceId: opts.ctx.workspace.id,
                  pageId: opts.input.id,
                  type: "monitor" as const,
                  monitorId: m.id,
                  name: mon?.name ?? "",
                  order: g.order,
                  groupId: pageGroups[i].id,
                  groupOrder: m.order,
                };
              }),
            ),
          );
        }

        if (opts.input.monitors.length > 0) {
          await tx.insert(pageComponent).values(
            opts.input.monitors.map((m) => {
              const mon = monitorMap.get(m.id);
              return {
                workspaceId: opts.ctx.workspace.id,
                pageId: opts.input.id,
                type: "monitor" as const,
                monitorId: m.id,
                name: mon?.name ?? "",
                order: m.order,
              };
            }),
          );
        }
      });
    }),
});
