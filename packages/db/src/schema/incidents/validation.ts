import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { incidentTable } from "./incident";

export const selectIncidentSchema = createSelectSchema(incidentTable).extend({
  monitorName: z.string().optional(),
});

export type Incident = z.infer<typeof selectIncidentSchema>;
