import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { feedback } from "./feedback";

export const insertFeedbackSchema = createInsertSchema(feedback);
export const selectFeedbackSchema = createSelectSchema(feedback);

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = z.infer<typeof selectFeedbackSchema>;
