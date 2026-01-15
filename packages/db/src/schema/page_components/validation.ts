import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { pageComponent } from "./page_components";

export const selectPageComponentSchema = createSelectSchema(pageComponent);

export const insertPageComponentSchema = createInsertSchema(pageComponent, {
  name: (schema) => schema.min(1),
}).refine(
  (data) => {
    // monitorId must be set when type='monitor'
    if (data.type === "monitor" && !data.monitorId) {
      return false;
    }
    // monitorId must be null when type='external'
    if (data.type === "external" && data.monitorId) {
      return false;
    }
    return true;
  },
  {
    message:
      "monitorId must be set when type is 'monitor' and must be null when type is 'external'",
  },
);

export type InsertPageComponent = z.infer<typeof insertPageComponentSchema>;
export type PageComponent = z.infer<typeof selectPageComponentSchema>;
