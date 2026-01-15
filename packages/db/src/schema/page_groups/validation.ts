import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { pageGroup } from "./page_groups";

export const selectPageGroupSchema = createSelectSchema(pageGroup);

export const insertPageGroupSchema = createInsertSchema(pageGroup);

export type InsertPageGroup = z.infer<typeof insertPageGroupSchema>;
export type PageGroup = z.infer<typeof selectPageGroupSchema>;
