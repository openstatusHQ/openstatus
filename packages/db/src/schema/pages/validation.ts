import type { ThemeKey } from "@openstatus/theme-store";
import { THEME_KEYS } from "@openstatus/theme-store";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { page } from "./page";

const slugSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9-]+$/,
    "Only use digits (0-9), hyphen (-) or characters (A-Z, a-z).",
  )
  .min(3)
  .toLowerCase();

const customDomainSchema = z
  .string()
  .regex(
    /^(?!https?:\/\/|www.)([a-zA-Z0-9]+(.[a-zA-Z0-9]+)+.*)$/,
    "Should not start with http://, https:// or www.",
  )
  .or(z.enum([""]));

export const insertPageSchema = createInsertSchema(page, {
  customDomain: customDomainSchema.default(""),
  icon: z.string().optional(),
  slug: slugSchema,
}).extend({
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
});

export const pageConfigurationSchema = z.object({
  value: z
    .enum(["duration", "requests", "manual"])
    .nullish()
    .prefault("requests"),
  type: z.enum(["absolute", "manual"]).nullish().prefault("absolute"),
  uptime: z.coerce.boolean().nullish().prefault(true),
  theme: z
    .enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]])
    .nullish()
    .prefault("default"),
});

export const selectPageSchema = createSelectSchema(page).extend({
  password: z.string().optional().nullable().prefault(""),
  configuration: pageConfigurationSchema.nullish().prefault({}),
});

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = z.infer<typeof selectPageSchema>;
