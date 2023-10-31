import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

import { incident, incidentStatus, incidentUpdate } from "./incident";

export const incidentStatusSchema = z.enum(incidentStatus);

export const insertIncidentUpdateSchema = createInsertSchema(incidentUpdate, {
  status: incidentStatusSchema,
});

export const insertIncidentSchema = createInsertSchema(incident, {
  status: incidentStatusSchema,
})
  .extend({
    date: z.date().optional().default(new Date()),
    /**
     * relationship to monitors and pages
     */
    monitors: z.number().array().optional().default([]),
    pages: z.number().array().optional().default([]),
  })
  .extend({
    /**
     * message for the `InsertIncidentUpdate`
     */
    message: z.string(),
  });

export const selectIncidentSchema = createSelectSchema(incident, {
  status: incidentStatusSchema,
});

export const selectIncidentUpdateSchema = createSelectSchema(incidentUpdate, {
  status: incidentStatusSchema,
});

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = z.infer<typeof selectIncidentSchema>;
export type InsertIncidentUpdate = z.infer<typeof insertIncidentUpdateSchema>;
export type IncidentUpdate = z.infer<typeof selectIncidentUpdateSchema>;
