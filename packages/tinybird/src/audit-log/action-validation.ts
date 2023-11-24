import { z } from "zod";

import { ingestBaseEventSchema, pipeBaseResponseData } from "./base-validation";

/**
 * The schema for the monitor.recovered action.
 * It represents the event when a monitor has recovered from a failure.
 */
const monitorUpSchema = z.object({
  action: z.literal("monitor.recovered"),
  metadata: z.object({ region: z.string(), statusCode: z.number() }),
});

/**
 * The schema for the monitor.failed action.
 * It represents the event when a monitor has failed.
 */
const monitorDownSchema = z.object({
  action: z.literal("monitor.failed"),
  metadata: z.object({
    region: z.string(),
    statusCode: z.number().optional(),
    message: z.string().optional(),
  }),
});

/**
 * The schema for the notification.send action.
 *
 */
const notificationSendSchema = z.object({
  action: z.literal("notification.send"),
  // we could use the notificationProviderSchema for more type safety
  metadata: z.object({ provider: z.string() }),
});

/**
 * The schema for the event object.
 * It extends the base schema. It uses the `discriminatedUnion` method for faster
 * evaluation to determine which schema to be used to parse the input.
 * It also transforms the metadata object into a string.
 *
 * @todo: whenever a new action is added, it should be included to the discriminatedUnion
 */
export const ingestActionEventSchema = z
  .intersection(
    // Unfortunately, the array cannot be dynamic, otherwise could be added to the Client
    // and made available to devs as library
    z.discriminatedUnion("action", [
      monitorUpSchema,
      monitorDownSchema,
      notificationSendSchema,
    ]),
    ingestBaseEventSchema,
  )
  .transform((val) => ({
    ...val,
    metadata: JSON.stringify(val.metadata),
  }));

/**
 * The schema for the response object.
 * It extends the base schema. It uses the `discriminatedUnion` method for faster
 * evaluation to determine which schema to be used to parse the input.
 * It also preprocesses the metadata string into the correct schema object.
 *
 * @todo: whenever a new action is added, it should be included to the discriminatedUnion
 */
export const pipeActionResponseData = z.intersection(
  z.discriminatedUnion("action", [
    monitorUpSchema.extend({
      metadata: z.preprocess(
        (val) => JSON.parse(String(val)),
        monitorUpSchema.shape.metadata,
      ),
    }),
    monitorDownSchema.extend({
      metadata: z.preprocess(
        (val) => JSON.parse(String(val)),
        monitorDownSchema.shape.metadata,
      ),
    }),
    notificationSendSchema.extend({
      metadata: z.preprocess(
        (val) => JSON.parse(String(val)),
        notificationSendSchema.shape.metadata,
      ),
    }),
  ]),
  pipeBaseResponseData,
);

export type IngestActionEvent = z.infer<typeof ingestActionEventSchema>;
export type PipeActionResponseData = z.infer<typeof pipeActionResponseData>;
