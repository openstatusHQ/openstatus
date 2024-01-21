import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { incidentTable } from "./incident";

export const selectIncidentSchema = createSelectSchema(incidentTable);

export type Incident = z.infer<typeof selectIncidentSchema>;
