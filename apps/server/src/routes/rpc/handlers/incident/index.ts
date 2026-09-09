import type { ServiceImpl } from "@connectrpc/connect";
import type { IncidentService } from "@openstatus/proto/incident/v1";
import {
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/proto/incident/v1";
import {
  acknowledgeIncident,
  createIncident,
  deleteIncident,
  getIncident,
  listIncidents,
  promoteIncident,
  resolveIncident,
  updateIncident,
} from "@openstatus/services/incident";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbIncidentToProto,
  protoOriginToDb,
  protoSeverityToDb,
  protoStatusToDb,
} from "./converters";
import {
  incidentIdRequiredError,
  invalidIncidentIdError,
  unsupportedEnumError,
} from "./errors";

const NUMERIC_ID = /^\d+$/;

function parseId(id: string): number {
  const trimmed = id.trim();
  if (trimmed.length === 0) throw incidentIdRequiredError();
  if (!NUMERIC_ID.test(trimmed)) throw invalidIncidentIdError(id);
  return Number(trimmed);
}

function parseComponentIds(ids: ReadonlyArray<string>): number[] {
  return ids.map((id) => {
    const trimmed = id.trim();
    if (!NUMERIC_ID.test(trimmed)) throw invalidIncidentIdError(id);
    return Number(trimmed);
  });
}

export const incidentServiceImpl: ServiceImpl<typeof IncidentService> = {
  async createIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    const severity =
      req.severity === IncidentSeverity.UNSPECIFIED
        ? "warning"
        : protoSeverityToDb(req.severity);
    if (!severity) throw unsupportedEnumError("severity");

    try {
      const incident = await createIncident({
        ctx: toServiceCtx(ctx),
        input: {
          title: req.title,
          summary: req.summary,
          severity,
          origin: "manual",
        },
      });
      return { incident: dbIncidentToProto(incident) };
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async getIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    try {
      const incident = await getIncident({
        ctx: toServiceCtx(ctx),
        input: { id: parseId(req.id) },
      });
      return { incident: dbIncidentToProto(incident) };
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async listIncidents(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    const status =
      req.status === undefined || req.status === IncidentStatus.UNSPECIFIED
        ? undefined
        : protoStatusToDb(req.status);
    const origin =
      req.origin === undefined ? undefined : protoOriginToDb(req.origin);

    try {
      const { items } = await listIncidents({
        ctx: toServiceCtx(ctx),
        input: { status, origin, order: "desc" },
      });
      return { incidents: items.map(dbIncidentToProto) };
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async updateIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    const status =
      req.status === undefined || req.status === IncidentStatus.UNSPECIFIED
        ? undefined
        : protoStatusToDb(req.status);
    const severity =
      req.severity === undefined ||
      req.severity === IncidentSeverity.UNSPECIFIED
        ? undefined
        : protoSeverityToDb(req.severity);

    try {
      const incident = await updateIncident({
        ctx: toServiceCtx(ctx),
        input: {
          id: parseId(req.id),
          title: req.title,
          summary: req.summary,
          status,
          severity,
        },
      });
      return { incident: dbIncidentToProto(incident) };
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async acknowledgeIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    try {
      const incident = await acknowledgeIncident({
        ctx: toServiceCtx(ctx),
        input: { id: parseId(req.id) },
      });
      return { incident: dbIncidentToProto(incident) };
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async resolveIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    try {
      const incident = await resolveIncident({
        ctx: toServiceCtx(ctx),
        input: { id: parseId(req.id) },
      });
      return { incident: dbIncidentToProto(incident) };
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async deleteIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    try {
      await deleteIncident({
        ctx: toServiceCtx(ctx),
        input: { id: parseId(req.id) },
      });
      return {};
    } catch (err) {
      throw toConnectError(err);
    }
  },

  async promoteIncident(req, handlerCtx) {
    const ctx = getRpcContext(handlerCtx);
    try {
      const { incident, statusReport } = await promoteIncident({
        ctx: toServiceCtx(ctx),
        input: {
          id: parseId(req.id),
          pageId: parseId(req.pageId),
          pageComponentIds: parseComponentIds(req.pageComponentIds),
          message: req.message,
        },
      });
      return {
        incident: dbIncidentToProto(incident),
        statusReportId: String(statusReport.id),
      };
    } catch (err) {
      throw toConnectError(err);
    }
  },
};
