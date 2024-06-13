import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { pageSubscriber } from "./page_subscribers";

export const insertPageSubscriberSchema = createInsertSchema(pageSubscriber, {
  email: z.string().email(),
});

export const selectPageSubscriberSchema = createSelectSchema(pageSubscriber);

export type InsertPageSubscriber = z.infer<typeof insertPageSubscriberSchema>;
export type PageSubscriber = z.infer<typeof selectPageSubscriberSchema>;
