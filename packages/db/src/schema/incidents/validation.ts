import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { incidentOrigin, incidentSeverity, incidentStatus } from "./constants";
import { incidentTable } from "./incident";

export const incidentStatusSchema = z.enum(incidentStatus);
export const incidentOriginSchema = z.enum(incidentOrigin);
export const incidentSeveritySchema = z.enum(incidentSeverity);

export const selectIncidentSchema = createSelectSchema(incidentTable);

export type Incident = z.infer<typeof selectIncidentSchema>;
