import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { privateLocationMonitorStatus } from "./private_location_monitor_status";
import { privateLocation } from "./private_locations";

export const insertPrivateLocationSchema = createInsertSchema(privateLocation);

export const selectPrivateLocationSchema = createSelectSchema(privateLocation);

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
