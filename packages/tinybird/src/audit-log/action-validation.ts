import { z } from "zod";

import { ingestBaseEventSchema } from "./base-validation";

const monitorUpSchema = z.object({
  action: z.literal("monitor.up"),
  metadata: z.object({ region: z.string() }),
});

const monitorDownSchema = z.object({
  action: z.literal("monitor.down"),
  metadata: z.object({ test: z.string() }),
});

export const ingestActionEventSchema = z
  .intersection(
    z.discriminatedUnion("action", [monitorUpSchema, monitorDownSchema]), // Unfortunately, the array cannot be dynamic
    ingestBaseEventSchema,
  )
  .transform((val) => ({
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
  ]),
  ingestBaseEventSchema,
);

export type IngestActionEventSchema = z.input<typeof ingestActionEventSchema>;
export type PipeActionResponseData = z.output<typeof pipeActionResponseData>;

//

export const logEvent: IngestActionEventSchema = {
  id: "monitor:1",
  action: "monitor.up",
  metadata: { region: "gru" },
};

// export const outputEvent: PipeActionResponseData = {
//   id: "monitor:1",
//   action: "monitor.up",
//   metadata: { region: "gru" },
// };
