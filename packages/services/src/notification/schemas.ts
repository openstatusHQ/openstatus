import { notificationProvider } from "@openstatus/db/src/schema/notifications/constants";
import { z } from "zod";

export { notificationProvider };
export const notificationProviderSchema = z.enum(notificationProvider);

// `data` mirrors the existing tRPC input shape: a partial record keyed by
// provider where each value is either a simple string (urls, phone numbers,
// tokens) or a nested record for structured configs (webhook headers, etc.).
// Persisted as a single JSON string on `notification.data`. Exported so the
// tRPC router reuses the same shape — otherwise the router's hand-rolled
// copy can silently drift from the service and accept inputs the service
// will reject.
export const NotificationDataInputSchema = z.partialRecord(
  notificationProviderSchema,
  z.union([
    z.string(),
    z.record(
      z.string(),
      z.union([
        z.string(),
        z.array(z.object({ key: z.string(), value: z.string() })),
      ]),
    ),
  ]),
);
export type NotificationDataInput = z.infer<typeof NotificationDataInputSchema>;

export const CreateNotificationInput = z.object({
  name: z.string().min(1),
  provider: notificationProviderSchema,
  data: NotificationDataInputSchema,
  monitors: z.array(z.number().int()).default([]),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationInput>;

export const UpdateNotificationInput = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  data: NotificationDataInputSchema,
  monitors: z.array(z.number().int()).default([]),
});
export type UpdateNotificationInput = z.infer<typeof UpdateNotificationInput>;

export const DeleteNotificationInput = z.object({ id: z.number().int() });
export type DeleteNotificationInput = z.infer<typeof DeleteNotificationInput>;

export const GetNotificationInput = z.object({ id: z.number().int() });
export type GetNotificationInput = z.infer<typeof GetNotificationInput>;

export const ListNotificationsInput = z.object({
  limit: z.number().int().min(1).default(50),
  offset: z.number().int().min(0).default(0),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListNotificationsInput = z.infer<typeof ListNotificationsInput>;
