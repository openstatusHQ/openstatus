import { z } from "zod";

export const RecordInboxEventInput = z.object({
  alertSourceId: z.number().int(),
  dedupKey: z.string().min(1),
  rawBody: z.string(),
  contentType: z.string().nullable().default(null),
  externalId: z.string().nullable().default(null),
  fingerprint: z.string().nullable().default(null),
  deadlineSeconds: z.number().int().positive().default(600),
  /** Settle immediately instead of queueing — over-limit or unparseable input. */
  settleAs: z.enum(["ignored", "invalid"]).nullable().default(null),
  settleReason: z.string().nullable().default(null),
});
export type RecordInboxEventInput = z.infer<typeof RecordInboxEventInput>;

export const PruneInboxInput = z.object({
  processedOlderThanDays: z.number().int().positive().default(7),
  ignoredOlderThanDays: z.number().int().positive().default(30),
  deadLetterOlderThanDays: z.number().int().positive().default(90),
});
export type PruneInboxInput = z.infer<typeof PruneInboxInput>;
