import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  maintenancesToPageComponents,
  pageComponent,
  pageComponentTypes,
  statusReportsToPageComponents,
} from "./page_component";

export const pageComponentTypesSchema = z.enum(pageComponentTypes);

export const selectPageComponentSchema = createSelectSchema(pageComponent, {
  type: pageComponentTypesSchema,
});

export const insertPageComponentSchema = createInsertSchema(pageComponent, {
  name: z
    .string()
    .min(1, "Name must be at least 1 character long")
    .max(255, "Name must be at most 255 characters long"),
  type: pageComponentTypesSchema,
  description: z.string().nullish(),
}).refine(
  (data) => {
    // Enforce: monitorId is required when type is 'monitor'
    if (data.type === "monitor" && !data.monitorId) {
      return false;
    }
    return true;
  },
  {
    message: "monitorId is required when type is 'monitor'",
    path: ["monitorId"],
  },
);

export const selectStatusReportToPageComponentSchema = createSelectSchema(
  statusReportsToPageComponents,
);

export const selectMaintenanceToPageComponentSchema = createSelectSchema(
  maintenancesToPageComponents,
);

export type InsertPageComponent = z.infer<typeof insertPageComponentSchema>;
export type PageComponent = z.infer<typeof selectPageComponentSchema>;
export type PageComponentType = z.infer<typeof pageComponentTypesSchema>;
export type StatusReportToPageComponent = z.infer<
  typeof selectStatusReportToPageComponentSchema
>;
export type MaintenanceToPageComponent = z.infer<
  typeof selectMaintenanceToPageComponentSchema
>;
