import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { privateLocation } from "./private_locations";

export const insertPrivateLocationSchema = createInsertSchema(privateLocation);

export const selectPrivateLocationSchema = createSelectSchema(privateLocation);

export type InsertPrivateLocation = z.infer<typeof insertPrivateLocationSchema>;
export type PrivateLocation = z.infer<typeof selectPrivateLocationSchema>;
