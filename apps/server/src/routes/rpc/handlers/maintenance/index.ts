import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import type { MaintenanceService } from "@openstatus/proto/maintenance/v1";
import {
  createMaintenance,
  deleteMaintenance,
  getMaintenance,
  listMaintenances,
  notifyMaintenance,
  updateMaintenance,
} from "@openstatus/services/maintenance";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbMaintenanceToProto,
  dbMaintenanceToProtoSummary,
} from "./converters";
import { invalidDateFormatError, maintenanceIdRequiredError } from "./errors";

function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw invalidDateFormatError(dateString);
  }
  return date;
}

function parsePageComponentIds(ids: ReadonlyArray<string>): number[] {
  return ids.map((id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) {
      throw new ConnectError(
        `Invalid page component id: "${id}"`,
        Code.InvalidArgument,
      );
    }
    return n;
  });
}

export const maintenanceServiceImpl: ServiceImpl<typeof MaintenanceService> = {
  async createMaintenance(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const sCtx = toServiceCtx(rpcCtx);

      const record = await createMaintenance({
        ctx: sCtx,
        input: {
          title: req.title,
          message: req.message,
          from: parseDate(req.from),
          to: parseDate(req.to),
          pageId: Number(req.pageId),
          pageComponentIds: parsePageComponentIds(req.pageComponentIds),
        },
      });

      if (req.notify) {
        await notifyMaintenance({
          ctx: sCtx,
          input: { maintenanceId: record.id },
        });
      }

      // Re-fetch so the response reflects stored IDs (dedup + validation
      // applied), not the raw request. Matches updateMaintenance and
      // createNotification.
      const full = await getMaintenance({
        ctx: sCtx,
        input: { id: record.id },
      });
      return {
        maintenance: dbMaintenanceToProto(
          full,
          full.pageComponentIds.map(String),
        ),
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getMaintenance(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      if (!req.id || req.id.trim() === "") {
        throw maintenanceIdRequiredError();
      }
      const full = await getMaintenance({
        ctx: toServiceCtx(rpcCtx),
        input: { id: Number(req.id) },
      });
      return {
        maintenance: dbMaintenanceToProto(
          full,
          full.pageComponentIds.map(String),
        ),
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async listMaintenances(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);

      const pageId =
        req.pageId && req.pageId.trim() !== "" ? Number(req.pageId) : undefined;

      const { items, totalSize } = await listMaintenances({
        ctx: toServiceCtx(rpcCtx),
        input: {
          limit: Math.min(Math.max(req.limit ?? 50, 1), 100),
          offset: req.offset ?? 0,
          pageId,
          order: "desc",
        },
      });

      return {
        maintenances: items.map((r) =>
          dbMaintenanceToProtoSummary(r, r.pageComponentIds.map(String)),
        ),
        totalSize,
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updateMaintenance(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const sCtx = toServiceCtx(rpcCtx);
      if (!req.id || req.id.trim() === "") {
        throw maintenanceIdRequiredError();
      }

      const id = Number(req.id);
      await updateMaintenance({
        ctx: sCtx,
        input: {
          id,
          title:
            req.title !== undefined && req.title !== "" ? req.title : undefined,
          message:
            req.message !== undefined && req.message !== ""
              ? req.message
              : undefined,
          from: req.from ? parseDate(req.from) : undefined,
          to: req.to ? parseDate(req.to) : undefined,
          pageComponentIds: req.updatePageComponentIds
            ? parsePageComponentIds(req.pageComponentIds)
            : undefined,
        },
      });

      const full = await getMaintenance({ ctx: sCtx, input: { id } });
      return {
        maintenance: dbMaintenanceToProto(
          full,
          full.pageComponentIds.map(String),
        ),
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async deleteMaintenance(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      if (!req.id || req.id.trim() === "") {
        throw maintenanceIdRequiredError();
      }
      await deleteMaintenance({
        ctx: toServiceCtx(rpcCtx),
        input: { id: Number(req.id) },
      });
      return { success: true };
    } catch (err) {
      toConnectError(err);
    }
  },
};
