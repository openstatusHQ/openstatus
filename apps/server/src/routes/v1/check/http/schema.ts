import { z } from "zod";
import { MonitorSchema } from "../../monitors/schema";

export const CheckSchema = MonitorSchema.pick({
  url: true,
  body: true,
  headers: true,
  method: true,
  regions: true,
})
  .extend({
    runCount: z
      .number()
      .max(5)
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

export const AggregatedResponseSchema = z
  .object({
    p50: z.number().openapi({ description: "The 50th percentile" }),
    p75: z.number().openapi({ description: "The 75th percentile" }),
    p95: z.number().openapi({ description: "The 95th percentile" }),
    p99: z.number().openapi({ description: "The 99th percentile" }),
    min: z.number().openapi({ description: "The minimum value" }),
    max: z.number().openapi({ description: "The maximum value" }),
  })
  .openapi({
    description: "The aggregated data of the check",
  });

export const ResponseSchema = z.object({
  timestamp: z
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
  aggregated: z
    .object({
      dns: AggregatedResponseSchema.openapi({
        description: "The aggregated DNS timing of the check",
      }),
      connection: AggregatedResponseSchema.openapi({
        description: "The aggregated connection timing of the check",
      }),
      tls: AggregatedResponseSchema.openapi({
        description: "The aggregated tls timing of the check",
      }),
      firstByte: AggregatedResponseSchema.openapi({
        description: "The aggregated first byte timing of the check",
      }),
      transfer: AggregatedResponseSchema.openapi({
        description: "The aggregated transfer timing of the check",
      }),
      latency: AggregatedResponseSchema.openapi({
        description: "The aggregated latency timing of the check",
      }),
    })
    .optional()
    .openapi({
      description: "The aggregated data dns timing of the check",
    }),
  region: z.string().openapi({ description: "The region where the check ran" }),
});

export const AggregatedResult = z.object({
  dns: AggregatedResponseSchema,
  connect: AggregatedResponseSchema,
  tls: AggregatedResponseSchema,
  firstByte: AggregatedResponseSchema,
  transfer: AggregatedResponseSchema,
  latency: AggregatedResponseSchema,
});

export const CheckPostResponseSchema = z.object({
  id: z.number().int().openapi({ description: "The id of the check" }),
  raw: z.array(TimingSchema).openapi({
    description: "The raw data of the check",
  }),
  response: ResponseSchema.openapi({
    description: "The last response of the check",
  }),
  aggregated: AggregatedResult.optional().openapi({
    description: "The aggregated data of the check",
  }),
});
