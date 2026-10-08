import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { incident, incidentEvent } from "./incident";
import { incidentPostmortem } from "./postmortem";

export const selectIncidentSchema = createSelectSchema(incident);
export const selectIncidentEventSchema = createSelectSchema(incidentEvent);
export const selectIncidentPostmortemSchema =
  createSelectSchema(incidentPostmortem);

export type Incident = z.infer<typeof selectIncidentSchema>;
export type IncidentEvent = z.infer<typeof selectIncidentEventSchema>;
export type IncidentPostmortem = z.infer<typeof selectIncidentPostmortemSchema>;
