import { locales } from "@openstatus/locales";
import type { ThemeKey } from "@openstatus/theme-store";
import { THEME_KEYS } from "@openstatus/theme-store";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { pageAccessTypes } from "./constants";
import { page } from "./page";

// Exported so `@openstatus/services` can reuse the canonical rules in
// its own `NewPageInput` / `UpdatePage*Input` schemas without
// duplicating the regex. Keep these as the single source of truth for
// slug and custom-domain shape validation.
export const slugSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9-]+$/,
    "Only use digits (0-9), hyphen (-) or characters (A-Z, a-z).",
  )
  .min(3)
  .toLowerCase();

export const customDomainSchema = z
  .string()
  .regex(
    /^(?!https?:\/\/|www.)([a-zA-Z0-9]+(.[a-zA-Z0-9]+)+.*)$/,
    "Should not start with http://, https:// or www.",
  )
  .or(z.enum([""]));

const stringToArray = z.preprocess((val) => {
  if (val && String(val).length > 0) {
    return String(val).split(",");
  }
  return [];
}, z.array(z.string()));

export const insertPageSchema = createInsertSchema(page, {
  customDomain: customDomainSchema.prefault(""),
  accessType: z.enum(pageAccessTypes).prefault("public"),
  icon: z.string().optional(),
  slug: slugSchema,
})
  .extend({
    password: z.string().nullable().optional().prefault(""),
    monitors: z
      .array(
        z.object({
          // REMINDER: has to be different from `id` in as the prop is already used by react-hook-form
          monitorId: z.number(),
          order: z.number().prefault(0).optional(),
        }),
      )
      .optional()
      .prefault([]),
    authEmailDomains: z.array(z.string()).nullish(),
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
    defaultLocale: z.enum(locales).optional().prefault("en"),
    locales: z.array(z.enum(locales)).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.locales && data.defaultLocale) {
        return data.locales.includes(data.defaultLocale);
      }
      return true;
    },
    {
      message: "Default locale must be included in the locales list",
      path: ["defaultLocale"],
    },
  );

// NOTE: every field uses `.nullish().transform(v => v ?? <default>)` so the
// OUTPUT is always a concrete enum value — never `null`/`undefined`. `.prefault`
// alone only handles `undefined`; without the transform a stored `null` (which
// the write path permits) leaks through and tanks downstream consumers that
// expect a strict enum (e.g. the status-page layout falling back to "absolute"
// barType and rendering manual-mode bars as empty).
export const pageConfigurationSchema = z.object({
  value: z
    .enum(["duration", "requests", "manual"])
    .nullish()
    .transform((v) => v ?? "requests"),
  type: z
    .enum(["absolute", "manual"])
    .nullish()
    .transform((v) => v ?? "absolute"),
  uptime: z.coerce
    .boolean()
    .nullish()
    .transform((v) => v ?? true),
  theme: z
    .enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]])
    .nullish()
    .transform((v) => v ?? "default"),
});
export type PageConfiguration = z.infer<typeof pageConfigurationSchema>;

export const selectPageSchema = createSelectSchema(page).extend({
  password: z.string().optional().nullable().prefault(""),
  configuration: pageConfigurationSchema.nullish().prefault({}),
  accessType: z.enum(pageAccessTypes).prefault("public"),
  authEmailDomains: stringToArray.prefault([]),
  allowedIpRanges: stringToArray.prefault([]),
  defaultLocale: z.enum(locales).prefault("en"),
  locales: z.array(z.enum(locales)).nullable().prefault(null),
});

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = z.infer<typeof selectPageSchema>;
