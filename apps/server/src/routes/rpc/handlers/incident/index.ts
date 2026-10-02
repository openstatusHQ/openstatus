import type { ServiceImpl } from "@connectrpc/connect";
import { sendIncidentCommander } from "@openstatus/emails";
import type { IncidentService } from "@openstatus/proto/incident/v1";
import type { ServiceContext } from "@openstatus/services";
import {
  actorDisplayName,
  addIncidentNote,
  afterIncidentClosed,
  afterIncidentDeclared,
  afterIncidentDeleted,
  afterIncidentStatusChanged,
  afterIncidentUpdated,
  afterPostmortemApproved,
  approvePostmortem,
  closeIncident,
  declareIncident,
  deleteIncident,
  draftPostmortem,
  escapeMrkdwn,
  getIncidentOrThrow,
  getPostmortem,
  type IncidentEffects,
  linkIncidentStatusReport,
  listIncidentEvents,
  listIncidents,
  resolveDashboardUrl,
  setIncidentStatus,
  unlinkIncidentStatusReport,
  updateIncident,
} from "@openstatus/services/incident";
import { findMemberIdByEmail } from "@openstatus/services/member";
import { WebClient } from "@slack/web-api";

import { env } from "@/env";
import { runInBackground } from "@/libs/background";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  incidentEventToProto,
  incidentSummaryToProto,
  incidentToProto,
  postmortemToProto,
  protoSeverityToDb,
  protoStatusToDb,
} from "./converters";
import {
  conflictingFieldsError,
  invalidCommanderError,
  invalidDateFormatError,
  invalidIdError,
} from "./errors";

const DASHBOARD_URL = resolveDashboardUrl({
  nodeEnv: env.NODE_ENV,
  override: env.DASHBOARD_URL,
});

const NUMERIC_ID = /^\d+$/;

function parseId(field: string, value: string): number {
  const trimmed = value.trim();
  if (!NUMERIC_ID.test(trimmed)) throw invalidIdError(field, value);
  return Number(trimmed);
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalidDateFormatError(value);
  return date;
}

async function resolveCommander(
  ctx: ServiceContext,
  email: string,
): Promise<number> {
  const id = await findMemberIdByEmail({ ctx, input: { email } });
  if (id === null) throw invalidCommanderError(email);
  return id;
}

async function effectsFor(ctx: ServiceContext): Promise<IncidentEffects> {
  const name = (await actorDisplayName(ctx)) ?? "An API key";
  return {
    clientFor: (token) => new WebClient(token),
    dashboardUrl: DASHBOARD_URL,
    sendCommanderEmail: sendIncidentCommander,
    actorLabel: escapeMrkdwn(name),
    assignedBy: name,
  };
}

function afterResponse(
  ctx: ServiceContext,
  label: string,
  incidentId: number,
  run: (effects: IncidentEffects) => Promise<unknown>,
): void {
  runInBackground(
    `incident ${label}`,
    async () => {
      await run(await effectsFor(ctx));
    },
    { incidentId },
  );
}

async function readIncident(ctx: ServiceContext, id: number) {
  return incidentToProto(await getIncidentOrThrow({ ctx, input: { id } }));
}

export const incidentServiceImpl: ServiceImpl<typeof IncidentService> = {
  async declareIncident(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const row = await declareIncident({
        ctx: sCtx,
        input: {
          title: req.title,
          severity: protoSeverityToDb(req.severity),
          summary: req.summary,
          commanderId:
            req.commanderEmail === undefined
              ? null
              : await resolveCommander(sCtx, req.commanderEmail),
          startedAt:
            req.startedAt === undefined ? undefined : parseDate(req.startedAt),
          statusReportId:
            req.statusReportId === undefined
              ? undefined
              : parseId("status_report_id", req.statusReportId),
        },
      });
      afterResponse(sCtx, "declare", row.id, (effects) =>
        afterIncidentDeclared({
          ctx: sCtx,
          effects,
          incident: row,
          openSlackChannel: req.openSlackChannel ?? false,
        }),
      );
      return { incident: await readIncident(sCtx, row.id) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getIncident(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      const view = await getIncidentOrThrow({ ctx: sCtx, input: { id } });
      const events = await listIncidentEvents({ ctx: sCtx, input: { id } });
      return { incident: incidentToProto(view, events) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async listIncidents(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const { items, totalSize } = await listIncidents({
        ctx: sCtx,
        input: {
          status: req.statuses.map(protoStatusToDb),
          closed: req.closed,
          limit: Math.min(Math.max(req.limit ?? 50, 1), 100),
          offset: req.offset ?? 0,
        },
      });
      return { incidents: items.map(incidentSummaryToProto), totalSize };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updateIncident(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      if (req.summary !== undefined && req.clearSummary) {
        throw conflictingFieldsError("summary", "clear_summary");
      }
      if (req.commanderEmail !== undefined && req.clearCommander) {
        throw conflictingFieldsError("commander_email", "clear_commander");
      }
      const before = await getIncidentOrThrow({ ctx: sCtx, input: { id } });
      const after = await updateIncident({
        ctx: sCtx,
        input: {
          id,
          title: req.title,
          severity:
            req.severity === undefined
              ? undefined
              : protoSeverityToDb(req.severity),
          summary: req.clearSummary ? null : req.summary,
          commanderId: req.clearCommander
            ? null
            : req.commanderEmail === undefined
              ? undefined
              : await resolveCommander(sCtx, req.commanderEmail),
          startedAt:
            req.startedAt === undefined ? undefined : parseDate(req.startedAt),
        },
      });
      afterResponse(sCtx, "update", id, (effects) =>
        afterIncidentUpdated({ ctx: sCtx, effects, before, after }),
      );
      return { incident: await readIncident(sCtx, id) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async setIncidentStatus(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      const note = req.note?.trim() || undefined;
      const row = await setIncidentStatus({
        ctx: sCtx,
        input: { id, status: protoStatusToDb(req.status), note },
      });
      afterResponse(sCtx, "status", id, (effects) =>
        afterIncidentStatusChanged({
          ctx: sCtx,
          effects,
          incidentId: id,
          status: row.status,
          note,
        }),
      );
      return { incident: await readIncident(sCtx, id) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async addIncidentNote(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      const added = await addIncidentNote({
        ctx: sCtx,
        input: { id, message: req.message },
      });
      const events = await listIncidentEvents({ ctx: sCtx, input: { id } });
      const event = events.find((e) => e.id === added.id);
      return {
        event: incidentEventToProto(event ?? { ...added, createdByUser: null }),
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async linkStatusReport(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      await linkIncidentStatusReport({
        ctx: sCtx,
        input: {
          id,
          statusReportId: parseId("status_report_id", req.statusReportId),
        },
      });
      return { incident: await readIncident(sCtx, id) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async unlinkStatusReport(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      await unlinkIncidentStatusReport({ ctx: sCtx, input: { id } });
      return { incident: await readIncident(sCtx, id) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async closeIncident(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      await closeIncident({
        ctx: sCtx,
        input: { id, skipPostmortem: req.skipPostmortem },
      });
      afterResponse(sCtx, "close", id, (effects) =>
        afterIncidentClosed({ ctx: sCtx, effects, incidentId: id }),
      );
      return { incident: await readIncident(sCtx, id) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async deleteIncident(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("id", req.id);
      const before = await getIncidentOrThrow({ ctx: sCtx, input: { id } });
      await deleteIncident({ ctx: sCtx, input: { id } });
      afterResponse(sCtx, "delete", id, (effects) =>
        afterIncidentDeleted({ ctx: sCtx, effects, before }),
      );
      return { success: true };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getPostmortem(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("incident_id", req.incidentId);
      const row = await getPostmortem({ ctx: sCtx, input: { id } });
      return { postmortem: row ? postmortemToProto(row) : undefined };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updatePostmortem(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("incident_id", req.incidentId);
      await draftPostmortem({
        ctx: sCtx,
        input: { id, content: req.content, draftedBy: "user" },
      });
      const row = await getPostmortem({ ctx: sCtx, input: { id } });
      return { postmortem: row ? postmortemToProto(row) : undefined };
    } catch (err) {
      toConnectError(err);
    }
  },

  async approvePostmortem(req, ctx) {
    try {
      const sCtx = toServiceCtx(getRpcContext(ctx));
      const id = parseId("incident_id", req.incidentId);
      const close = req.close ?? false;
      const before = await getIncidentOrThrow({ ctx: sCtx, input: { id } });
      await approvePostmortem({ ctx: sCtx, input: { id, close } });
      const closed = close && !before.closedAt;
      afterResponse(sCtx, "approve postmortem", id, (effects) =>
        afterPostmortemApproved({ ctx: sCtx, effects, incidentId: id, closed }),
      );
      const row = await getPostmortem({ ctx: sCtx, input: { id } });
      return {
        postmortem: row ? postmortemToProto(row) : undefined,
        incident: await readIncident(sCtx, id),
      };
    } catch (err) {
      toConnectError(err);
    }
  },
};
