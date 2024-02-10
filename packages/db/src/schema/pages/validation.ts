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
  monitors: z.array(z.number()).optional().default([]),
});

export const selectPageSchema = createSelectSchema(page);

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = z.infer<typeof selectPageSchema>;
