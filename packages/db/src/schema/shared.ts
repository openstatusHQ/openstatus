import { z } from "zod";

import { selectIncidentSchema, selectIncidentUpdateSchema } from "./incidents";
import { selectMonitorSchema } from "./monitors";
import { selectPageSchema } from "./pages";

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

export const selectPublicMonitorSchema = selectMonitorSchema.omit({
  body: true,
  headers: true,
  regions: true,
  method: true,
});

export const selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(selectPublicMonitorSchema),
    incidents: selectIncidentsPageSchema,
  })
  .omit({
    workspaceId: true,
    id: true,
  });
