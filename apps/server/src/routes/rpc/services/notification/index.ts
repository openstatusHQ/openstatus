import type { ServiceImpl } from "@connectrpc/connect";
import { and, count, db, desc, eq, inArray, sql } from "@openstatus/db";
import {
  monitor,
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";
import { NotificationProvider, type NotificationService } from "@openstatus/proto/notification/v1";

import { getRpcContext } from "../../interceptors";
import {
  dbNotificationToProto,
  dbNotificationToProtoSummary,
  dbProviderToProto,
  protoDataToDb,
  protoProviderToDb,
  validateProviderDataConsistency,
} from "./converters";
import {
  invalidNotificationDataError,
  monitorNotFoundError,
  notificationCreateFailedError,
  notificationIdRequiredError,
  notificationNotFoundError,
  notificationUpdateFailedError,
} from "./errors";
import {
  checkNotificationLimit,
  checkProviderAllowed,
  getNotificationLimitInfo,
} from "./limits";
import { sendTestNotification } from "./test-providers";

// Type that works with both db instance and transaction
type DB = typeof db;
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Helper to get a notification by ID with workspace scope.
 */
async function getNotificationById(id: number, workspaceId: number) {
  return db
    .select()
    .from(notification)
    .where(
      and(eq(notification.id, id), eq(notification.workspaceId, workspaceId)),
    )
    .get();
}

/**
 * Helper to get monitor IDs for a notification.
 */
async function getMonitorIdsForNotification(
  notificationId: number,
): Promise<string[]> {
  const monitors = await db
    .select({ monitorId: notificationsToMonitors.monitorId })
    .from(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, notificationId))
    .all();

  return monitors.map((m) => String(m.monitorId));
}

/**
 * Helper to get monitor count for a notification.
 */
async function getMonitorCountForNotification(
  notificationId: number,
): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, notificationId))
    .get();

  return result?.count ?? 0;
}

/**
 * Validates that all monitor IDs belong to the workspace.
 * Throws monitorNotFoundError if any monitor is not found.
 */
async function validateMonitorIds(
  monitorIds: string[],
  workspaceId: number,
  tx: DB | Transaction = db,
): Promise<number[]> {
  if (monitorIds.length === 0) {
    return [];
  }

  const numericIds = monitorIds.map((id) => Number(id));

  const validMonitors = await tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, numericIds),
        eq(monitor.workspaceId, workspaceId),
      ),
    )
    .all();

  const validIds = new Set(validMonitors.map((m) => m.id));

  for (const id of numericIds) {
    if (!validIds.has(id)) {
      throw monitorNotFoundError(String(id));
    }
  }

  return numericIds;
}

/**
 * Helper to update monitor associations for a notification.
 */
async function updateMonitorAssociations(
  notificationId: number,
  monitorIds: number[],
  tx: DB | Transaction = db,
) {
  // Delete existing associations
  await tx
    .delete(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, notificationId));

  // Insert new associations
  if (monitorIds.length > 0) {
    await tx.insert(notificationsToMonitors).values(
      monitorIds.map((monitorId) => ({
        notificationId,
        monitorId,
      })),
    );
  }
}

/**
 * Notification service implementation for ConnectRPC.
 */
export const notificationServiceImpl: ServiceImpl<typeof NotificationService> =
  {
    async createNotification(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      const limits = rpcCtx.workspace.limits;

      // Check notification limit
      await checkNotificationLimit(workspaceId, limits);

      // Check if provider is allowed for this plan
      checkProviderAllowed(req.provider, limits);

      // Validate provider-data consistency
      const validationError = validateProviderDataConsistency(
        req.provider,
        req.data,
      );
      if (validationError) {
        throw invalidNotificationDataError(validationError);
      }

      // Create notification in a transaction
      const newNotification = await db.transaction(async (tx) => {
        // Validate monitor IDs
        const validMonitorIds = await validateMonitorIds(
          req.monitorIds,
          workspaceId,
          tx,
        );

        // Convert proto data to DB format
        const dataStr = protoDataToDb(req.provider, req.data);

        // Create the notification
        const record = await tx
          .insert(notification)
          .values({
            name: req.name,
            provider: protoProviderToDb(req.provider),
            data: dataStr,
            workspaceId,
          })
          .returning()
          .get();

        if (!record) {
          throw notificationCreateFailedError();
        }

        // Create monitor associations
        await updateMonitorAssociations(record.id, validMonitorIds, tx);

        return record;
      });

      return {
        notification: dbNotificationToProto(newNotification, req.monitorIds),
      };
    },

    async getNotification(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.id || req.id.trim() === "") {
        throw notificationIdRequiredError();
      }

      const record = await getNotificationById(Number(req.id), workspaceId);
      if (!record) {
        throw notificationNotFoundError(req.id);
      }

      const monitorIds = await getMonitorIdsForNotification(record.id);

      return {
        notification: dbNotificationToProto(record, monitorIds),
      };
    },

    async listNotifications(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
      const offset = req.offset ?? 0;

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(notification)
        .where(eq(notification.workspaceId, workspaceId))
        .get();

      const totalCount = countResult?.count ?? 0;

      // Get notifications
      const records = await db
        .select()
        .from(notification)
        .where(eq(notification.workspaceId, workspaceId))
        .orderBy(desc(notification.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // Get monitor counts for each notification
      const notifications = await Promise.all(
        records.map(async (record) => {
          const monitorCount = await getMonitorCountForNotification(record.id);
          return dbNotificationToProtoSummary(record, monitorCount);
        }),
      );

      return {
        notifications,
        totalSize: totalCount,
      };
    },

    async updateNotification(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.id || req.id.trim() === "") {
        throw notificationIdRequiredError();
      }

      const record = await getNotificationById(Number(req.id), workspaceId);
      if (!record) {
        throw notificationNotFoundError(req.id);
      }

      // Validate provider-data consistency if data is being updated
      if (req.data !== undefined) {
        const existingProvider = dbProviderToProto(record.provider);
        const validationError = validateProviderDataConsistency(
          existingProvider,
          req.data,
        );
        if (validationError) {
          throw invalidNotificationDataError(validationError);
        }
      }

      // Update notification in a transaction
      const updatedNotification = await db.transaction(async (tx) => {
        // Validate monitor IDs
        const validMonitorIds = await validateMonitorIds(
          req.monitorIds,
          workspaceId,
          tx,
        );

        // Build update values
        const updateValues: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (req.name !== undefined && req.name !== "") {
          updateValues.name = req.name;
        }

        if (req.data !== undefined) {
          // Use the existing provider since we can't change provider on update
          updateValues.data = protoDataToDb(
            // Provider can't change, so we'll use the current data's case
            req.data.data.case !== undefined
              ? (() => {
                  // Map case to NotificationProvider
                  const caseToProvider: Record<string, number> = {
                    discord: NotificationProvider.DISCORD,
                    email: NotificationProvider.EMAIL,
                    googleChat: NotificationProvider.GOOGLE_CHAT,
                    grafanaOncall: NotificationProvider.GRAFANA_ONCALL,
                    ntfy: NotificationProvider.NTFY,
                    pagerduty: NotificationProvider.PAGERDUTY,
                    opsgenie: NotificationProvider.OPSGENIE,
                    slack: NotificationProvider.SLACK,
                    sms: NotificationProvider.SMS,
                    telegram: NotificationProvider.TELEGRAM,
                    webhook: NotificationProvider.WEBHOOK,
                    whatsapp: NotificationProvider.WHATSAPP,
                  };
                  return caseToProvider[req.data.data.case] ?? NotificationProvider.UNSPECIFIED;
                })()
              : 0,
            req.data,
          );
        }

        // Update monitor associations
        await updateMonitorAssociations(record.id, validMonitorIds, tx);

        // Update the notification
        const updated = await tx
          .update(notification)
          .set(updateValues)
          .where(eq(notification.id, record.id))
          .returning()
          .get();

        if (!updated) {
          throw notificationUpdateFailedError(req.id);
        }

        return updated;
      });

      // Fetch updated monitor IDs
      const monitorIds = await getMonitorIdsForNotification(
        updatedNotification.id,
      );

      return {
        notification: dbNotificationToProto(updatedNotification, monitorIds),
      };
    },

    async deleteNotification(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.id || req.id.trim() === "") {
        throw notificationIdRequiredError();
      }

      const record = await getNotificationById(Number(req.id), workspaceId);
      if (!record) {
        throw notificationNotFoundError(req.id);
      }

      // Delete the notification (cascade will delete associations)
      await db.delete(notification).where(eq(notification.id, record.id));

      return { success: true };
    },

    async sendTestNotification(req, _ctx) {
      const result = await sendTestNotification(req.provider, req.data);
      return result;
    },

    async checkNotificationLimit(_req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      const limits = rpcCtx.workspace.limits;

      const info = await getNotificationLimitInfo(workspaceId, limits);

      return info;
    },
  };
