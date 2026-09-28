import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { incident, incidentEvent } from "./incident";

export const selectIncidentSchema = createSelectSchema(incident);
export const selectIncidentEventSchema = createSelectSchema(incidentEvent);

export type Incident = z.infer<typeof selectIncidentSchema>;
export type IncidentEvent = z.infer<typeof selectIncidentEventSchema>;
