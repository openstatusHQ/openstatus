import type { z } from "zod";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { pageComponentGroup } from "./page_component_groups";

export const selectPageComponentGroupSchema =
  createSelectSchema(pageComponentGroup);

export const insertPageComponentGroupSchema =
  createInsertSchema(pageComponentGroup);

export type InsertPageComponentGroup = z.infer<
  typeof insertPageComponentGroupSchema
>;
export type PageComponentGroup = z.infer<typeof selectPageComponentGroupSchema>;
