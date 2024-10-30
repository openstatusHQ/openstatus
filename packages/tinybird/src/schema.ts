import { z } from "zod";

export const jobTypes = ["http", "tcp", "imcp", "udp", "dns", "ssl"] as const;
export const jobTypeEnum = z.enum(jobTypes);
export type JobType = z.infer<typeof jobTypeEnum>;

export const periods = ["1h", "1d", "3d", "7d", "14d", "45d"] as const;
export const periodEnum = z.enum(periods);
export type Period = z.infer<typeof periodEnum>;

export const triggers = ["cron", "api"] as const;
export const triggerEnum = z.enum(triggers);
export type Trigger = z.infer<typeof triggerEnum>;

export const headersSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const value = z.record(z.string(), z.string()).safeParse(JSON.parse(val));
    if (value.success) return value.data;
    return null;
  });

export const httpTimingSchema = z.object({
  dnsStart: z.number(),
  dnsDone: z.number(),
  connectStart: z.number(),
  connectDone: z.number(),
  tlsHandshakeStart: z.number(),
  tlsHandshakeDone: z.number(),
  firstByteStart: z.number(),
  firstByteDone: z.number(),
  transferStart: z.number(),
  transferDone: z.number(),
});

export const timingSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const value = httpTimingSchema.safeParse(JSON.parse(val));
    if (value.success) return value.data;
    return null;
  });
