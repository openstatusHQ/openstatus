import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type SQL, and, desc, eq, inArray, isNull, sql } from "@openstatus/db";
import {
  insertPageSchema,
  monitor,
  page,
  pageAccessTypes,
  pageComponent,
  selectMaintenanceSchema,
  selectPageComponentGroupSchema,
  selectPageComponentSchema,
  selectPageSchema,
  subdomainSafeList,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { locales } from "@openstatus/locales";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";

if (process.env.NODE_ENV === "test") {
  require("../test/preload");
}

// Helper functions to reuse Vercel API logic
async function addDomainToVercel(domain: string) {
  const response = await fetch(
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

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Failed to add domain to Vercel:", { domain, error });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to add custom domain. Please try again. If it continues, contact support.",
    });
  }

  return response.json();
}

async function removeDomainFromVercel(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
      },
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Failed to remove domain from Vercel:", { domain, error });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to remove custom domain. Please try again. If it continues, contact support.",
    });
  }

  return response.json();
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
        // We should make sure the user has access to the monitors AND they are active
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            eq(monitor.active, true), // Only allow active monitors
            isNull(monitor.deletedAt),
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You don't have access to all the monitors or some monitors are inactive.",
          });
        }

        // Build a map for quick lookup
        const monitorMap = new Map(allMonitors.map((m) => [m.id, m]));

        // Build pageComponent values (primary table)
        const pageComponentValues = monitors
          .map(({ monitorId }, index) => {
            const m = monitorMap.get(monitorId);
            if (!m || !m.workspaceId) return null;
            return {
              workspaceId: m.workspaceId,
              pageId: newPage.id,
              type: "monitor" as const,
              monitorId,
              name: m.externalName || m.name,
              order: index,
              groupId: null,
              groupOrder: 0,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        // Insert into pageComponents (primary table)
        await opts.ctx.db
          .insert(pageComponent)
          .values(pageComponentValues)
          .run();
      }

      return newPage;
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
          maintenances: true,
          pageComponents: true,
          pageComponentGroups: true,
        },
      });

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      return selectPageSchema
        .extend({
          pageComponentGroups: z
            .array(selectPageComponentGroupSchema)
            .prefault([]),
          maintenances: z.array(selectMaintenanceSchema).prefault([]),
          pageComponents: z.array(selectPageComponentSchema).prefault([]),
        })
        .parse({
          ...data,
          pageComponentGroups: data.pageComponentGroups ?? [],
          maintenances: data.maintenances,
          pageComponents: data.pageComponents,
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
          allowIndex: true,
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

      // Vercel operations first — if they fail, DB is not touched
      if (newDomain && !oldDomain) {
        // Adding a new domain
        await addDomainToVercel(newDomain);

        await opts.ctx.db
          .update(page)
          .set({ customDomain: newDomain, updatedAt: new Date() })
          .where(and(...whereConditions))
          .run();
      } else if (oldDomain && newDomain && newDomain !== oldDomain) {
        // Changing domain - add new first, then remove old
        await addDomainToVercel(newDomain);
        await removeDomainFromVercel(oldDomain);

        await opts.ctx.db
          .update(page)
          .set({ customDomain: newDomain, updatedAt: new Date() })
          .where(and(...whereConditions))
          .run();
      } else if (oldDomain && newDomain === "") {
        // Removing domain
        await removeDomainFromVercel(oldDomain);

        await opts.ctx.db
          .update(page)
          .set({ customDomain: "", updatedAt: new Date() })
          .where(and(...whereConditions))
          .run();
      } else if (newDomain) {
        // Same domain re-submitted — ensure it's synced to Vercel
        await addDomainToVercel(newDomain);

        await opts.ctx.db
          .update(page)
          .set({ customDomain: newDomain, updatedAt: new Date() })
          .where(and(...whereConditions))
          .run();
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
        allowIndex: z.boolean().optional(),
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

      if (opts.input.allowIndex === false && limit["no-index"] === false) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Disabling search engine indexing is not available for your current plan.",
        });
      }

      await opts.ctx.db
        .update(page)
        .set({
          accessType: opts.input.accessType,
          authEmailDomains: opts.input.authEmailDomains?.join(","),
          password: opts.input.password,
          ...(opts.input.allowIndex !== undefined && {
            allowIndex: opts.input.allowIndex,
          }),
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

  updateLocales: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(
      z
        .object({
          id: z.number(),
          defaultLocale: z.enum(locales),
          locales: z.array(z.enum(locales)).nullable(),
        })
        .refine(
          (data) => {
            if (data.locales) {
              return data.locales.includes(data.defaultLocale);
            }
            return true;
          },
          {
            message: "Default locale must be included in the locales list",
            path: ["defaultLocale"],
          },
        ),
    )
    .mutation(async (opts) => {
      if (!opts.ctx.workspace.limits.i18n) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Upgrade to configure locales.",
        });
      }

      const whereConditions: SQL[] = [
        eq(page.workspaceId, opts.ctx.workspace.id),
        eq(page.id, opts.input.id),
      ];

      await opts.ctx.db
        .update(page)
        .set({
          defaultLocale: opts.input.defaultLocale,
          locales: opts.input.locales,
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
});
