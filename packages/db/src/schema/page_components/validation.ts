import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { pageComponentImpact } from "./constants";
import {
  pageComponent,
  statusReportUpdateToPageComponents,
} from "./page_components";

export const selectPageComponentSchema = createSelectSchema(pageComponent);

export const insertPageComponentSchema = createInsertSchema(pageComponent, {
  name: z.string().min(1),
}).refine(
  (data) => {
    switch (data.type) {
      case "monitor":
        return (
          !!data.monitorId &&
          !data.externalServiceId &&
          !data.externalServiceComponentId
        );
      case "static":
        return (
          !data.monitorId &&
          !data.externalServiceId &&
          !data.externalServiceComponentId
        );
      case "external":
        return !data.monitorId && !!data.externalServiceId;
      default:
        return false;
    }
  },
  {
    message:
      "monitor requires monitorId; static requires no refs; external requires externalServiceId",
  },
);

export type InsertPageComponent = z.infer<typeof insertPageComponentSchema>;
export type PageComponent = z.infer<typeof selectPageComponentSchema>;

export const pageComponentImpactSchema = z.enum(pageComponentImpact);

export const selectStatusReportUpdateToPageComponentSchema = createSelectSchema(
  statusReportUpdateToPageComponents,
  { impact: pageComponentImpactSchema },
);

export const insertStatusReportUpdateToPageComponentSchema = createInsertSchema(
  statusReportUpdateToPageComponents,
  { impact: pageComponentImpactSchema },
);

export type StatusReportUpdateToPageComponent = z.infer<
  typeof selectStatusReportUpdateToPageComponentSchema
>;
