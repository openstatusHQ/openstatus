import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { checkerOutbox, notificationDeadLetter } from "./checker_outbox";

export const checkerOutboxPayloadSchema = z.object({
  regions: z.array(z.string()),
  statusCode: z.number().optional(),
  message: z.string().optional(),
  latency: z.number().optional(),
});

export type CheckerOutboxPayload = z.infer<typeof checkerOutboxPayloadSchema>;

export const selectCheckerOutboxSchema = createSelectSchema(checkerOutbox);
export const selectNotificationDeadLetterSchema = createSelectSchema(
  notificationDeadLetter,
);

export type CheckerOutboxRow = typeof checkerOutbox.$inferSelect;
export type NotificationDeadLetterRow =
  typeof notificationDeadLetter.$inferSelect;
