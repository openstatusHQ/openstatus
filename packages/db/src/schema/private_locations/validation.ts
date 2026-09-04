import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { privateLocationMonitorStatus } from "./private_location_monitor_status";
import { privateLocation, privateLocationStatus } from "./private_locations";

export const privateLocationStatusSchema = z.enum(privateLocationStatus);

const privateLocationMetadataSchema = z.record(z.string(), z.string());

export const insertPrivateLocationSchema = createInsertSchema(privateLocation, {
  status: privateLocationStatusSchema.prefault("error"),
  metadata: privateLocationMetadataSchema.nullish(),
});

export const selectPrivateLocationSchema = createSelectSchema(privateLocation, {
  status: privateLocationStatusSchema,
  metadata: privateLocationMetadataSchema.nullable(),
});

export type InsertPrivateLocation = z.infer<typeof insertPrivateLocationSchema>;
export type PrivateLocation = z.infer<typeof selectPrivateLocationSchema>;

export const insertPrivateLocationMonitorStatusSchema = createInsertSchema(
  privateLocationMonitorStatus,
);

export const selectPrivateLocationMonitorStatusSchema = createSelectSchema(
  privateLocationMonitorStatus,
);

export type InsertPrivateLocationMonitorStatus = z.infer<
  typeof insertPrivateLocationMonitorStatusSchema
>;
export type PrivateLocationMonitorStatus = z.infer<
  typeof selectPrivateLocationMonitorStatusSchema
>;
