import type { ServiceImpl } from "@connectrpc/connect";
import type { NotificationService } from "@openstatus/proto/notification/v1";
import {
  createNotification,
  deleteNotification,
  getNotification,
  listNotifications,
  updateNotification,
} from "@openstatus/services/notification";

import { ForbiddenError } from "@openstatus/services";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbNotificationToProto,
  dbNotificationToProtoSummary,
  dbProviderToProto,
  protoDataToDb,
  protoProviderToDb,
} from "./converters";
import { monitorNotFoundError, notificationIdRequiredError } from "./errors";
import { getNotificationLimitInfo } from "./limits";
import { sendTestNotification } from "./test-providers";

type ProtoData = Parameters<typeof protoDataToDb>[1];

/**
 * Translate the proto `NotificationData` oneof into the loose record shape
 * the service expects (`Partial<Record<Provider, …>>`). Round-trips through
 * the existing `protoDataToDb` helper + JSON.parse so we don't reimplement
 * the per-provider mapping.
 *
 * A `JSON.parse` failure here would mean `protoDataToDb` itself produced
 * malformed output — a programmer error, not a user-input issue. Letting
 * the throw propagate surfaces it as `Code.Internal` via `toConnectError`,
 * which is the signal we want; catch-and-return-empty would hide the
 * bug and feed an empty object into `validateNotificationData`,
 * producing a generic validation failure far from the root cause.
 */
function protoDataToServiceInput(
  provider: number,
  data: ProtoData | undefined,
): Record<string, unknown> {
  if (!data) return {};
  return JSON.parse(protoDataToDb(provider, data));
}

/**
 * Remap the service's `ForbiddenError` (thrown by `validateMonitorIds`
 * on an unknown or cross-workspace monitor) to `monitorNotFoundError`
 * (Code.NotFound / HTTP 404). The service deliberately doesn't
 * distinguish "monitor doesn't exist" from "monitor in another
 * workspace" (an existence-leak guard), but the Connect contract
 * surfaces this as 404 so clients keying on the status code get the
 * same "resource not accessible" signal regardless of cause.
 */
function rethrowMonitorNotFound(err: unknown, monitorIds: string[]): never {
  if (err instanceof ForbiddenError && err.message.startsWith("Monitor ")) {
    throw monitorNotFoundError(monitorIds.join(","));
  }
  throw err;
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
        }).catch((err) => rethrowMonitorNotFound(err, req.monitorIds));
        // Re-fetch to get the authoritative persisted monitor set —
        // mirrors the `updateNotification` pattern and removes the
        // approximation that used to echo `req.monitorIds` deduped.
        // `createNotification` returns only the base row; the monitor
        // ids come from the `notifications_to_monitors` associations
        // which `getNotification` batches alongside the read.
        const full = await getNotification({
          ctx: sCtx,
          input: { id: record.id },
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
                : // Drizzle infers the column as `string | null` (the
                  // schema has a `default("{}")` but no `.notNull()`),
                  // so the fallback to `"{}"` prevents a
                  // `SyntaxError` when a legacy row left `data` NULL.
                  (JSON.parse(existing.data ?? "{}") as never),
            monitors: req.updateMonitorIds
              ? req.monitorIds.map((mid) => Number(mid))
              : existing.monitors.map((m) => m.id),
          },
        }).catch((err) => rethrowMonitorNotFound(err, req.monitorIds));

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
      // Wrapped in `toConnectError` for symmetry with the CRUD handlers
      // above — any `ServiceError` / `ZodError` thrown from within
      // `test-providers.ts` (or a future helper it grows) gets mapped
      // to the right gRPC status instead of falling through to the
      // interceptor's generic catch.
      try {
        return await sendTestNotification(req.provider, req.data);
      } catch (err) {
        toConnectError(err);
      }
    },

    async checkNotificationLimit(_req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      const limits = rpcCtx.workspace.limits;

      const info = await getNotificationLimitInfo(workspaceId, limits);
      return info;
    },
  };
