import * as z from "zod";

/**
 * The base schema for every event, used to validate it's structure
 * on datasource ingestion and pipe retrieval.
 */
export const baseSchema = z.object({
  id: z.string().min(1),
  action: z.string(),
  timestamp: z.number().int().default(Date.now()),
  version: z.number().int().default(1),
});

/**
 * The schema for the actor object.
 * It represents the user that triggered the event.
 */
export const actorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .default({
    id: "",
    name: "system",
  });

/**
 * The schema for the targets object.
 * It represents the targets that are permitted to access the entry.
 */
export const targetsSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .array()
  .optional();

/**
 * The schema for the metadata object.
 * All the extra information that is not part of the base schema.
 */
export const metadataSchema = z.record(z.unknown()).optional();

/**
 * The schema for the event object.
 * It extends the base schema and transforms the actor, targets and metadata
 * objects into strings.
 */
export const ingestEventSchema = baseSchema.extend({
  actor: actorSchema.transform((val) => JSON.stringify(val)),
  targets: targetsSchema.transform((val) => JSON.stringify(val)),
  metadata: metadataSchema.transform((val) => JSON.stringify(val)),
});

/**
 * The schema for the response object.
 * It extends the base schema and transforms the actor, targets and metadata objects
 * back into typed objects.
 */
export const pipeResponseData = baseSchema.extend({
  actor: z.preprocess((val) => JSON.parse(String(val)), actorSchema),
  targets: z.preprocess(
    (val) => (val ? JSON.parse(String(val)) : undefined),
    targetsSchema,
  ),
  metadata: z.preprocess((val) => JSON.parse(String(val)), metadataSchema),
});

/**
 * The schema for the parameters object.
 * It represents the parameters that are passed to the pipe.
 */
export const pipeParameterData = z.object({ event_id: z.string().min(1) });

export type BaseSchemaInput = z.input<typeof baseSchema>;
export type IngestEventSchemaInput = z.input<typeof ingestEventSchema>;

export type BaseSchema = z.infer<typeof baseSchema>;
export type ActorSchema = z.infer<typeof actorSchema>;
export type TargetsSchema = z.infer<typeof targetsSchema>;
export type MetadataSchema = z.infer<typeof metadataSchema>;

export type IngestEventSchema = z.infer<typeof ingestEventSchema>;
export type PipeResponseDataSchema = z.infer<typeof pipeResponseData>;
export type PipeParameterDataSchema = z.infer<typeof pipeParameterData>;
