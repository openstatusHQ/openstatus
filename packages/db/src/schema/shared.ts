import { z } from "zod";

import { selectIncidentSchema, selectIncidentUpdateSchema } from "./incident";
import { selectMonitorSchema } from "./monitor";
import { selectPageSchema } from "./page";

export const selectIncidentsPageSchema = z.array(
  selectIncidentSchema.extend({
    incidentUpdates: z.array(selectIncidentUpdateSchema),
  }),
);
export const selectPageSchemaWithRelation = selectPageSchema.extend({
  monitors: z.array(selectMonitorSchema),
  incidents: selectIncidentsPageSchema,
});
