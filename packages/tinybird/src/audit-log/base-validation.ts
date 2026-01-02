import { z } from "zod";

/**
 * The base schema for every event, used to validate it's structure
 * on datasource ingestion and pipe retrieval.
 */
export const baseSchema = z.object({
  id: z.string().min(1), // DISCUSS: we could use the `${targets.type}:${targets.id}` format automatic generation
  action: z.string(),
  // REMINDER: do not use .default(Date.now()), it will be evaluated only once
  timestamp: z
    .number()
    .int()
    .optional()
    .transform((val) => val || Date.now()),
  version: z.number().int().default(1),
});

/**
 * The schema for the actor type.
 * It represents the type of the user that triggered the event.
 */
export const actorTypeSchema = z.enum(["user", "system"]);

/**
 * The schema for the actor object.
 * It represents the user that triggered the event.
 */
export const actorSchema = z
  .object({
    id: z.string(),
    type: actorTypeSchema,
  })
  .default({
    id: "server",
    type: "system",
  });

/**
 * The schema for the target type.
 * It represents the type of the target that is affected by the event.
 */
export const targetTypeSchema = z.enum([
  "monitor",
  "page",
  // "incident", // has been removed from the schema
  "status-report",
  "user",
  "notification",
  "organization",
]);

/**
 * The schema for the targets object.
 * It represents the targets that are affected by the event.
 */
export const targetsSchema = z
  .object({
    id: z.string(),
    type: targetTypeSchema,
  })
  .array()
  .optional();

/**
 * The schema for the event object.
 * It extends the base schema and transforms the actor, targets
 * objects into strings.
 */
export const ingestBaseEventSchema = baseSchema.extend({
  actor: actorSchema.transform((val) => JSON.stringify(val)),
  targets: targetsSchema.transform((val) => JSON.stringify(val)),
});

/**
 * The schema for the response object.
 * It extends the base schema and transforms the actor, targets
 * back into typed objects.
 */
export const pipeBaseResponseData = baseSchema.extend({
  actor: z.preprocess((val) => JSON.parse(String(val)), actorSchema),
  targets: z.preprocess(
    (val) => (val ? JSON.parse(String(val)) : undefined),
    targetsSchema,
  ),
});

/**
 * The schema for the parameters object.
 * It represents the parameters that are passed to the pipe.
 */
export const pipeParameterData = z.object({ event_id: z.string().min(1) });

export type PipeParameterData = z.infer<typeof pipeParameterData>;
export type PipeBaseResponseData = z.infer<typeof pipeBaseResponseData>;
export type IngestBaseEvent = z.infer<typeof ingestBaseEventSchema>;
