import { z } from "zod";

import { selectIncidentSchema, selectIncidentUpdateSchema } from "./incident";
import { selectMonitorSchema } from "./monitor";
import { selectPageSchema } from "./page";

export const selectIncidentsPageSchema = z.array(
  selectIncidentSchema.extend({
    incidentUpdates: z.array(selectIncidentUpdateSchema),
    monitorsToIncidents: z.array(
      z.object({ monitorId: z.number(), incidentId: z.number() }),
    ),
  }),
);
export const selectPageSchemaWithRelation = selectPageSchema.extend({
  monitors: z.array(selectMonitorSchema),
  incidents: selectIncidentsPageSchema,
});
