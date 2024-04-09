import { z } from "zod";

import {
  monitorDegradedSchema,
  monitorFailedSchema,
  monitorRecoveredSchema,
  notificationSentSchema,
} from "./action-schema";
import { ingestBaseEventSchema, pipeBaseResponseData } from "./base-validation";

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
      monitorRecoveredSchema,
      monitorDegradedSchema,
      monitorFailedSchema,
      notificationSentSchema,
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
    monitorRecoveredSchema.extend({
      metadata: z.preprocess(
        (val) => JSON.parse(String(val)),
        monitorRecoveredSchema.shape.metadata,
      ),
    }),
    monitorFailedSchema.extend({
      metadata: z.preprocess(
        (val) => JSON.parse(String(val)),
        monitorFailedSchema.shape.metadata,
      ),
    }),
    notificationSentSchema.extend({
      metadata: z.preprocess(
        (val) => JSON.parse(String(val)),
        notificationSentSchema.shape.metadata,
      ),
    }),
  ]),
  pipeBaseResponseData,
);

export type IngestActionEvent = z.infer<typeof ingestActionEventSchema>;
export type PipeActionResponseData = z.infer<typeof pipeActionResponseData>;
