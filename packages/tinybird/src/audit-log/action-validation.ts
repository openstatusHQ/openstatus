import { z } from "zod";

import { ingestBaseEventSchema, pipeBaseResponseData } from "./base-validation";

// TODO: add description to every action

const monitorUpSchema = z.object({
  action: z.literal("monitor.recovered"),
  metadata: z.object({ region: z.string(), statusCode: z.number() }),
});

const monitorDownSchema = z.object({
  action: z.literal("monitor.failed"),
  metadata: z.object({
    region: z.string(),
    statusCode: z.number().optional(),
    message: z.string().optional(),
  }),
});

const notificationSendSchema = z.object({
  action: z.literal("notification.send"),
  // we could use the notificationProviderSchema for more type safety
  metadata: z.object({ provider: z.string() }),
});

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

export type IngestActionEventSchema = z.input<typeof ingestActionEventSchema>;
export type PipeActionResponseData = z.output<typeof pipeActionResponseData>;
