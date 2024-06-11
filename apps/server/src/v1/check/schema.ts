import { z } from "zod";
import { MonitorSchema } from "../monitors/schema";

export const CheckSchema = MonitorSchema.pick({
  url: true,
  body: true,
  headers: true,
  method: true,
  regions: true,
  assertions: true,
})
  .extend({
    runCount: z
      .number()
      .optional()
      .default(1)
      .openapi({ description: "The number of times to run the check" }),
    aggregated: z
      .boolean()
      .optional()
      .openapi({ description: "Whether to aggregate the results or not" }),
    //   webhook: z
    //     .string()
    //     .optional()
    //     .openapi({ description: "The webhook to send the result to" }),
  })
  .openapi({
    description: "The check request",
  });

export const TimingSchema = z.object({
  dnsStart: z
    .number()
    .openapi({ description: "DNS timestamp start time in UTC " }),
  dnsDone: z
    .number()
    .openapi({ description: "DNS timestamp end time in UTC " }),
  connectStart: z
    .number()
    .openapi({ description: "Connect timestamp start time in UTC " }),
  connectDone: z
    .number()
    .openapi({ description: "Connect timestamp end time in UTC " }),
  tlsHandshakeStart: z
    .number()
    .openapi({ description: "TLS handshake timestamp start time in UTC " }),
  tlsHandshakeDone: z
    .number()
    .openapi({ description: "TLS handshake timestamp end time in UTC " }),
  firstByteStart: z
    .number()
    .openapi({ description: "First byte timestamp start time in UTC " }),
  firstByteDone: z
    .number()
    .openapi({ description: "First byte timestamp end time in UTC " }),
  transferStart: z
    .number()
    .openapi({ description: "Transfer timestamp start time in UTC " }),
  transferDone: z
    .number()
    .openapi({ description: "Transfer timestamp end time in UTC " }),
});

export const ResponseSchema = z.object({
  timeStamp: z
    .number()
    .openapi({ description: "The timestamp of the response in UTC" }),
  status: z
    .number()
    .openapi({ description: "The status code of the response" }),
  latency: z.number().openapi({ description: "The latency of the response" }),
  body: z
    .string()
    .optional()
    .openapi({ description: "The body of the response" }),
  headers: z
    .record(z.string())
    .optional()
    .openapi({ description: "The headers of the response" }),
  timing: TimingSchema.openapi({
    description: "The timing metrics of the response",
  }),
  region: z.string().openapi({ description: "The region where the check ran" }),
});

export const CheckPostResponseSchema = z.object({
  id: z.number().int().openapi({ description: "The id of the check" }),
  raw: z.array(TimingSchema).openapi({
    description: "The raw data of the check",
  }),
  response: ResponseSchema.openapi({
    description: "The last response of the check",
  }),
});
