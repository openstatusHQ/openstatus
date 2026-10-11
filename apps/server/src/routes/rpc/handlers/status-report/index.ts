import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import type {
  ComponentImpact,
  StatusReportService,
} from "@openstatus/proto/status_report/v1";
import { StatusReportStatus } from "@openstatus/proto/status_report/v1";
import {
  addStatusReportUpdate,
  createStatusReport,
  deleteStatusReport,
  deleteStatusReportUpdate,
  getStatusReport,
  listStatusReports,
  notifyStatusReport,
  updateStatusReport,
  updateStatusReportUpdate,
} from "@openstatus/services/status-report";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbReportToProto,
  dbReportToProtoSummary,
  dbUpdateToProto,
  protoImpactToDb,
  protoStatusToDb,
} from "./converters";
import {
  invalidDateFormatError,
  statusReportIdRequiredError,
  statusReportUpdateIdRequiredError,
} from "./errors";

function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw invalidDateFormatError(dateString);
  }
  return date;
}

// Match the digits explicitly: `Number("")` is 0 (finite!), so a blank id used
// to slip through and target component 0, and `Number.parseInt("1.5")` is 1, so
// swapping in parseInt alone would still truncate a malformed id silently.
const DECIMAL_ID = /^\d+$/;

function parseId(value: string, label: string): number {
  const trimmed = value.trim();
  // past 2^53 the digits round to a neighbouring id
  const id = Number(trimmed);
  if (!DECIMAL_ID.test(trimmed) || !Number.isSafeInteger(id)) {
    throw new ConnectError(
      `Invalid ${label}: "${value}"`,
      Code.InvalidArgument,
    );
  }
  return id;
}

function parsePageComponentIds(ids: ReadonlyArray<string>): number[] {
  return ids.map((id) => parseId(id, "page component id"));
}

// empty list ⇒ undefined: an old client omitting the field must produce a
// legacy report (zero impact rows), never default to operational
function parseComponentImpacts(
  impacts: ReadonlyArray<ComponentImpact>,
):
  | { pageComponentId: number; impact: ReturnType<typeof protoImpactToDb> }[]
  | undefined {
  if (impacts.length === 0) return undefined;
  return impacts.map((ci) => ({
    pageComponentId: parseId(ci.pageComponentId, "page component id"),
    impact: protoImpactToDb(ci.impact),
  }));
}

export const statusReportServiceImpl: ServiceImpl<typeof StatusReportService> =
  {
    async createStatusReport(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);

        if (!req.pageId?.trim()) {
          throw statusReportIdRequiredError();
        }
        const pageId = parseId(req.pageId, "page id");

        const { statusReport, initialUpdate } = await createStatusReport({
          ctx: sCtx,
          input: {
            title: req.title,
            status: protoStatusToDb(req.status),
            message: req.message,
            date: parseDate(req.date),
            pageId,
            pageComponentIds: parsePageComponentIds(req.pageComponentIds),
            componentImpacts: parseComponentImpacts(req.componentImpacts),
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
          input: { id: parseId(req.id, "status report id") },
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

        const id = parseId(req.id, "status report id");
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
          input: { id: parseId(req.id, "status report id") },
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

        const statusReportId = parseId(req.statusReportId, "status report id");
        const { statusReport: updatedReport, statusReportUpdate: newUpdate } =
          await addStatusReportUpdate({
            ctx: sCtx,
            input: {
              statusReportId,
              status: protoStatusToDb(req.status),
              message: req.message,
              date: req.date ? parseDate(req.date) : undefined,
              componentImpacts: parseComponentImpacts(req.componentImpacts),
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

    async updateStatusReportUpdate(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        const sCtx = toServiceCtx(rpcCtx);
        if (!req.id?.trim()) {
          throw statusReportUpdateIdRequiredError();
        }
        const id = parseId(req.id, "status report update id");
        const edited = await updateStatusReportUpdate({
          ctx: sCtx,
          input: {
            id,
            status:
              req.status !== undefined
                ? protoStatusToDb(req.status)
                : undefined,
            message: req.message,
            date: req.date ? parseDate(req.date) : undefined,
            // repeated can't distinguish empty from absent, so the flag decides
            componentImpacts: req.updateComponentImpacts
              ? (parseComponentImpacts(req.componentImpacts) ?? [])
              : undefined,
          },
        });
        // the row alone has no impact rows; re-read through the report
        const full = await getStatusReport({
          ctx: sCtx,
          input: { id: edited.statusReportId },
        });
        const update = full.updates.find((u) => u.id === id);
        if (!update) {
          throw new ConnectError(
            `Status report update ${id} was deleted concurrently`,
            Code.NotFound,
          );
        }
        return { statusReportUpdate: dbUpdateToProto(update) };
      } catch (err) {
        toConnectError(err);
      }
    },

    async deleteStatusReportUpdate(req, ctx) {
      try {
        const rpcCtx = getRpcContext(ctx);
        if (!req.id?.trim()) {
          throw statusReportUpdateIdRequiredError();
        }
        await deleteStatusReportUpdate({
          ctx: toServiceCtx(rpcCtx),
          input: { id: parseId(req.id, "status report update id") },
        });
        return { success: true };
      } catch (err) {
        toConnectError(err);
      }
    },
  };
