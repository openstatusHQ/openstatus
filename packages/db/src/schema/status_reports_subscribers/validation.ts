import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { statusReportSubscriber } from "./status_reports_subscribers";

export const insertStatusReportSubscriberSchema = createInsertSchema(
  statusReportSubscriber,
  {
    email: z.string().email(),
  },
);

export const selectStatusReportSubscriberSchema = createSelectSchema(
  statusReportSubscriber,
);

export type InsertStatusReportSubscriber = z.infer<
  typeof insertStatusReportSubscriberSchema
>;
export type StatusReportSubscriber = z.infer<
  typeof selectStatusReportSubscriberSchema
>;
