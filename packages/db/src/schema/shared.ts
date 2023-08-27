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

export const selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(
      selectMonitorSchema.omit({
        body: true,
        headers: true,
        regions: true,
        method: true,
      }),
    ),
    incidents: selectIncidentsPageSchema,
  })
  .omit({
    workspaceId: true,
    id: true,
  });
