import { Events } from "@openstatus/analytics";
import { locales } from "@openstatus/locales";
import { NotFoundError } from "@openstatus/services";
import { getUptimeHistory } from "@openstatus/services/frozen-uptime";
import {
  createPage,
  type CreatePageInput,
  // `CreatePageInput` re-exports the drizzle insert schema so routers
  // don't need to import it directly from `@openstatus/db`.
  CreatePageInput as CreatePageInputSchema,
  deletePage,
  getPage,
  getSlugAvailable,
  listPages,
  newPage,
  pageAccessTypes,
  updatePageAppearance,
  UpdatePageAppearanceInput,
  updatePageConfiguration,
  UpdatePageConfigurationInput,
  setPageCustomDomain,
  UpdatePageCustomDomainInput,
  updatePageCustomTheme,
  UpdatePageCustomThemeInput,
  updatePageGeneral,
  updatePageLinks,
  updatePageLocales,
  updatePagePasswordProtection,
} from "@openstatus/services/page";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreatePage, trackProps: ["slug"] })
    .input(CreatePageInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPage({
          ctx: toServiceCtx(ctx),
          input: input as CreatePageInput,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeletePage })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deletePage({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        if (err instanceof NotFoundError) return;
        toTRPCError(err);
      }
    }),

  getSlugUniqueness: protectedProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getSlugAvailable({
          ctx: toServiceCtx(ctx),
          input: { slug: input.slug },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  list: protectedProcedure
    .input(z.object({ order: z.enum(["asc", "desc"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listPages({
          ctx: toServiceCtx(ctx),
          input: { order: input?.order ?? "desc" },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getPage({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  getUptimeHistory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getUptimeHistory({
          ctx: toServiceCtx(ctx),
          input: { pageId: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
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
    .mutation(async ({ ctx, input }) => {
      try {
        return await newPage({
          ctx: toServiceCtx(ctx),
          input: {
            title: input.title,
            slug: input.slug,
            icon: input.icon,
            description: input.description,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
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
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageGeneral({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateCustomDomain: protectedProcedure
    .meta({ track: Events.UpdatePageDomain, trackProps: ["customDomain"] })
    .input(UpdatePageCustomDomainInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await setPageCustomDomain({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
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
        allowedIpRanges: z
          .array(
            z
              .string()
              .transform((s) => {
                const trimmed = s.trim();
                return trimmed.includes("/") ? trimmed : `${trimmed}/32`;
              })
              .pipe(z.cidrv4()),
          )
          .nullish(),
        allowIndex: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePagePasswordProtection({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateAppearance: protectedProcedure
    .meta({ track: Events.UpdatePage })
    // Reuse the service schema so `configuration.theme` is validated
    // against `THEME_KEYS` at the tRPC boundary; the prior local
    // `z.object({ theme: z.string() })` accepted arbitrary strings
    // that later failed the status-page read-parse.
    .input(UpdatePageAppearanceInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageAppearance({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateCustomTheme: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(UpdatePageCustomThemeInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageCustomTheme({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
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
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageLinks({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
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
          (data) =>
            data.locales ? data.locales.includes(data.defaultLocale) : true,
          {
            message: "Default locale must be included in the locales list",
            path: ["defaultLocale"],
          },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageLocales({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updatePageConfiguration: protectedProcedure
    .meta({ track: Events.UpdatePage })
    // Reuse the service's canonical `pageConfigurationSchema`-backed
    // input — the old `z.record(z.string(), z.string()|z.boolean())`
    // accepted any key and any string value, persisting configurations
    // the status-page read parser would reject.
    .input(UpdatePageConfigurationInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageConfiguration({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
