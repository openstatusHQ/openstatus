import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { user } from "./user";

export const insertUserSchema = createInsertSchema(user);

export const selectUserSchema = createSelectSchema(user);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;
