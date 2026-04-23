import type { ServiceImpl } from "@connectrpc/connect";
import type { StatusReportService } from "@openstatus/proto/status_report/v1";
import { StatusReportStatus } from "@openstatus/proto/status_report/v1";
import {
  addStatusReportUpdate,
  createStatusReport,
  deleteStatusReport,
  getStatusReport,
  listStatusReports,
  notifyStatusReport,
  updateStatusReport,
} from "@openstatus/services/status-report";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbReportToProto,
  dbReportToProtoSummary,
  protoStatusToDb,
} from "./converters";
import { invalidDateFormatError, statusReportIdRequiredError } from "./errors";

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
      throw invalidDateFormatError(id); // reuse the numeric-parse error vocabulary
    }
    return n;
  });
}

export const statusReportServiceImpl: ServiceImpl<typeof StatusReportService> =
  {
    async createStatusReport(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);

        const pageId = req.pageId?.trim() ? Number(req.pageId.trim()) : null;
        if (pageId === null) {
          throw statusReportIdRequiredError();
        }

        const { statusReport, initialUpdate } = await createStatusReport({
          ctx: sCtx,
          input: {
            title: req.title,
            status: protoStatusToDb(req.status),
            message: req.message,
            date: parseDate(req.date),
            pageId,
            pageComponentIds: parsePageComponentIds(req.pageComponentIds),
          },
        });

        if (req.notify) {
          await notifyStatusReport({
            ctx: sCtx,
            input: { statusReportUpdateId: initialUpdate.id },
          });
        }

        const full = await getStatusReport({
          ctx: sCtx,
          input: { id: statusReport.id },
        });
        return {
          statusReport: dbReportToProto(
            full,
            full.pageComponentIds.map(String),
            full.updates,
          ),
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async getStatusReport(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        if (!req.id || req.id.trim() === "") {
          throw statusReportIdRequiredError();
        }

        const full = await getStatusReport({
          ctx: toServiceCtx(rpcCtx),
          input: { id: Number(req.id) },
        });
        return {
          statusReport: dbReportToProto(
            full,
            full.pageComponentIds.map(String),
            full.updates,
          ),
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async listStatusReports(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);

        const statuses =
          req.statuses.length > 0
            ? req.statuses
                .filter((s) => s !== StatusReportStatus.UNSPECIFIED)
                .map(protoStatusToDb)
            : [];

        const { items, totalSize } = await listStatusReports({
          ctx: toServiceCtx(rpcCtx),
          input: {
            limit: Math.min(Math.max(req.limit ?? 50, 1), 100),
            offset: req.offset ?? 0,
            statuses,
            order: "desc",
          },
        });

        return {
          statusReports: items.map((r) =>
            dbReportToProtoSummary(r, r.pageComponentIds.map(String)),
          ),
          totalSize,
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async updateStatusReport(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);
        if (!req.id || req.id.trim() === "") {
          throw statusReportIdRequiredError();
        }

        const id = Number(req.id);
        await updateStatusReport({
          ctx: sCtx,
          input: {
            id,
            title:
              req.title !== undefined && req.title !== ""
                ? req.title
                : undefined,
            pageComponentIds: req.updatePageComponentIds
              ? parsePageComponentIds(req.pageComponentIds)
              : undefined,
          },
        });

        const full = await getStatusReport({ ctx: sCtx, input: { id } });
        return {
          statusReport: dbReportToProto(
            full,
            full.pageComponentIds.map(String),
            full.updates,
          ),
        };
      } catch (err) {
        toConnectError(err);
      }
    },

    async deleteStatusReport(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        if (!req.id || req.id.trim() === "") {
          throw statusReportIdRequiredError();
        }
        await deleteStatusReport({
          ctx: toServiceCtx(rpcCtx),
          input: { id: Number(req.id) },
        });
        return { success: true };
      } catch (err) {
        toConnectError(err);
      }
    },

    async addStatusReportUpdate(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);
        if (!req.statusReportId || req.statusReportId.trim() === "") {
          throw statusReportIdRequiredError();
        }

        const statusReportId = Number(req.statusReportId);
        const { statusReport: updatedReport, statusReportUpdate: newUpdate } =
          await addStatusReportUpdate({
            ctx: sCtx,
            input: {
              statusReportId,
              status: protoStatusToDb(req.status),
              message: req.message,
              date: req.date ? parseDate(req.date) : undefined,
            },
          });

        if (req.notify && updatedReport.pageId) {
          await notifyStatusReport({
            ctx: sCtx,
            input: { statusReportUpdateId: newUpdate.id },
          });
        }

        const full = await getStatusReport({
          ctx: sCtx,
          input: { id: statusReportId },
        });
        return {
          statusReport: dbReportToProto(
            full,
            full.pageComponentIds.map(String),
            full.updates,
          ),
        };
      } catch (err) {
        toConnectError(err);
      }
    },
  };
