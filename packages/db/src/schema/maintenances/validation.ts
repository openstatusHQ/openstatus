import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { maintenance } from "./maintenance";

export const insertMaintenanceSchema = createInsertSchema(maintenance)
  .extend({
    // REMINDER: trick to make the react-hook-form controlled but not allow empty string
    title: z.string().min(1, {
      error: "Required",
    }),
    message: z.string().min(1, {
      error: "Required",
    }),

    monitors: z.number().array().prefault([]).optional(),
  })
  // REMINDER: validate that `from` date is before `to` date
  .refine((data) => data.from < data.to, {
    path: ["to"],
    message: "End date cannot be earlier than start date.",
  });

export const selectMaintenanceSchema = createSelectSchema(maintenance).extend({
  monitors: z.number().array().prefault([]).optional(),
});

export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type Maintenance = z.infer<typeof selectMaintenanceSchema>;
