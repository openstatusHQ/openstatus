import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

import {
  statusReport,
  statusReportStatus,
  statusReportUpdate,
} from "./status_reports";

export const statusReportStatusSchema = z.enum(statusReportStatus);

export const insertStatusReportUpdateSchema = createInsertSchema(
  statusReportUpdate,
  {
    status: statusReportStatusSchema,
  }
);

export const insertStatusReportSchema = createInsertSchema(statusReport, {
  status: statusReportStatusSchema,
})
  .extend({
    date: z.date().optional().default(new Date()),
    /**
     * relationship to monitors and pages
     */
  })
  .extend({
    /**
     * message for the `InsertIncidentUpdate`
     */
    message: z.string(),
  });

export const selectStatusReportSchema = createSelectSchema(statusReport, {
  status: statusReportStatusSchema,
});

export const selectStatusReportUpdateSchema = createSelectSchema(
  statusReportUpdate,
  {
    status: statusReportStatusSchema,
  }
);

export type InsertStatusReport = z.infer<typeof insertStatusReportSchema>;
export type StatusReport = z.infer<typeof selectStatusReportSchema>;
export type InsertStatusReportUpdate = z.infer<
  typeof insertStatusReportUpdateSchema
>;
export type StatusReportUpdate = z.infer<typeof selectStatusReportUpdateSchema>;
