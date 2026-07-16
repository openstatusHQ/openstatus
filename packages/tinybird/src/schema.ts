import { z } from "zod";

export const jobTypes = ["http", "tcp", "icmp", "udp", "dns", "ssl"] as const;
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

export function transformTiming(val: string) {
  if (!val) return null;
  const value = httpTimingSchema.safeParse(JSON.parse(val));
  if (value.success) return value.data;
  return null;
}

// 0 = phase hook never fired (e.g. timeout before first byte); subtracting
// absolute epoch timestamps would yield huge negative durations.
function phaseDuration(start: number, done: number) {
  if (start === 0 || done === 0) return 0;
  return done - start;
}

export function calculateTiming(obj: z.infer<typeof httpTimingSchema>) {
  if (!obj) return null;

  return {
    dns: phaseDuration(obj.dnsStart, obj.dnsDone),
    connect: phaseDuration(obj.connectStart, obj.connectDone),
    tls: phaseDuration(obj.tlsHandshakeStart, obj.tlsHandshakeDone),
    ttfb: phaseDuration(obj.firstByteStart, obj.firstByteDone),
    transfer: phaseDuration(obj.transferStart, obj.transferDone),
  };
}

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

export const timingPhasesSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const value = httpTimingSchema.safeParse(JSON.parse(val));
    if (value.success) return calculateTiming(value.data);
    return null;
  });
