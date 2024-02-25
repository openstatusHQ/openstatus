import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { oauthAccount, session, user } from "./user";

export const insertUserSchema = createInsertSchema(user);

export const selectUserSchema = createSelectSchema(user);

export const selectSessionSchema = createSelectSchema(session);
export const selectOauthAccountSchema = createSelectSchema(oauthAccount);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;
export type Session = z.infer<typeof selectSessionSchema>;
export type OauthAccount = z.infer<typeof selectOauthAccountSchema>;
