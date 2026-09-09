import { alertProviderSchema } from "@openstatus/db/src/schema";
import { z } from "zod";

export { alertProviderSchema };

export const FindOrCreateAlertSourceInput = z.object({
  provider: alertProviderSchema,
});
export type FindOrCreateAlertSourceInput = z.infer<
  typeof FindOrCreateAlertSourceInput
>;

export const UpdateAlertSourceConfigInput = z.object({
  id: z.number().int(),
  stalenessWindowMinutes: z.number().int().positive().optional(),
  signatureSecret: z.string().nullable().optional(),
});
export type UpdateAlertSourceConfigInput = z.infer<
  typeof UpdateAlertSourceConfigInput
>;

export const SetAlertSourceActiveInput = z.object({
  id: z.number().int(),
  active: z.boolean(),
});
export type SetAlertSourceActiveInput = z.infer<
  typeof SetAlertSourceActiveInput
>;
