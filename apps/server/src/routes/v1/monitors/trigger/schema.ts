import { z } from "@hono/zod-openapi";
import { ParamsSchema } from "../schema";

export { ParamsSchema };

export const TriggerSchema = z.object({
  resultId: z.number().openapi({ description: "the id of your check result" }),
});

export type TriggerSchema = z.infer<typeof TriggerSchema>;
