import type { ServiceImpl } from "@connectrpc/connect";
import type { NotificationService } from "@openstatus/proto/notification/v1";
import {
  createNotification,
  deleteNotification,
  getNotification,
  listNotifications,
  updateNotification,
} from "@openstatus/services/notification";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbNotificationToProto,
  dbNotificationToProtoSummary,
  dbProviderToProto,
  protoDataToDb,
  protoProviderToDb,
} from "./converters";
import { notificationIdRequiredError } from "./errors";
import { getNotificationLimitInfo } from "./limits";
import { sendTestNotification } from "./test-providers";

type ProtoData = Parameters<typeof protoDataToDb>[1];

/**
 * Translate the proto `NotificationData` oneof into the loose record shape
 * the service expects (`Partial<Record<Provider, …>>`). Round-trips through
 * the existing `protoDataToDb` helper + JSON.parse so we don't reimplement
 * the per-provider mapping.
 */
function protoDataToServiceInput(
  provider: number,
  data: ProtoData | undefined,
): Record<string, unknown> {
  if (!data) return {};
  const dataStr = protoDataToDb(provider, data);
  try {
    return JSON.parse(dataStr);
  } catch {
    return {};
  }
}

export const notificationServiceImpl: ServiceImpl<typeof NotificationService> =
  {
    async createNotification(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);

        const record = await createNotification({
          ctx: sCtx,
          input: {
            name: req.name,
            provider: protoProviderToDb(req.provider),
            data: protoDataToServiceInput(req.provider, req.data) as never,
            monitors: req.monitorIds.map((id) => Number(id)),
          },
        });
        return {
          notification: dbNotificationToProto(record, req.monitorIds),
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async getNotification(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        if (!req.id || req.id.trim() === "") {
          throw notificationIdRequiredError();
        }

        const full = await getNotification({
          ctx: toServiceCtx(rpcCtx),
          input: { id: Number(req.id) },
        });
        return {
          notification: dbNotificationToProto(
            full,
            full.monitors.map((m) => String(m.id)),
          ),
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async listNotifications(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);

        const { items, totalSize } = await listNotifications({
          ctx: toServiceCtx(rpcCtx),
          input: {
            limit: Math.min(Math.max(req.limit ?? 50, 1), 100),
            offset: req.offset ?? 0,
            order: "desc",
          },
        });

        return {
          notifications: items.map((n) =>
            dbNotificationToProtoSummary(n, n.monitors.length),
          ),
          totalSize,
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async updateNotification(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);
        if (!req.id || req.id.trim() === "") {
          throw notificationIdRequiredError();
        }

        const id = Number(req.id);
        // Connect's update is partial — read the stored record so we can
        // supply the missing fields to the service (which expects a full
        // update payload).
        const existing = await getNotification({ ctx: sCtx, input: { id } });
        const provider = dbProviderToProto(existing.provider);

        await updateNotification({
          ctx: sCtx,
          input: {
            id,
            name:
              req.name !== undefined && req.name !== ""
                ? req.name
                : existing.name,
            data:
              req.data !== undefined
                ? (protoDataToServiceInput(provider, req.data) as never)
                : (JSON.parse(existing.data) as never),
            monitors: req.updateMonitorIds
              ? req.monitorIds.map((mid) => Number(mid))
              : existing.monitors.map((m) => m.id),
          },
        });

        const full = await getNotification({ ctx: sCtx, input: { id } });
        return {
          notification: dbNotificationToProto(
            full,
            full.monitors.map((m) => String(m.id)),
          ),
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async deleteNotification(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        if (!req.id || req.id.trim() === "") {
          throw notificationIdRequiredError();
        }
        await deleteNotification({
          ctx: toServiceCtx(rpcCtx),
          input: { id: Number(req.id) },
        });
        return { success: true };
      } catch (err) {
        toConnectError(err);
      }
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
