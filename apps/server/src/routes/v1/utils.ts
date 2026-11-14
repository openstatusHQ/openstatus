import { z } from "@hono/zod-openapi";
import type { ServiceContext } from "@openstatus/services";
import { meetIncidentResponseByStatusReport } from "@openstatus/services/incident";
import type { Context } from "hono";
import { ZodError } from "zod";

import type { Variables } from "./index";

export const isoDate = z.preprocess((val) => {
  try {
    if (val) {
      return new Date(String(val)).toISOString();
    }
    return new Date().toISOString();
  } catch (_e) {
    throw new ZodError([
      {
        code: "invalid_type",
        message: "Invalid date",
        expected: "string",
        path: [],
      },
    ]);
  }
}, z.string());

export function isNumberArray<T>(
  monitors: number[] | T[],
): monitors is number[] {
  return (
    Array.isArray(monitors) &&
    monitors.every((item) => typeof item === "number")
  );
}

/** The services context for a v1 request, attributed to its API key. */
function v1ServiceCtx(c: Context<{ Variables: Variables }>): ServiceContext {
  const apiKey = c.get("apiKey");
  return {
    workspace: c.get("workspace"),
    actor: {
      type: "apiKey",
      keyId: apiKey.id,
      userId: apiKey.createdById,
      scopes: apiKey.scopes,
    },
    requestId: c.get("requestId"),
  };
}

/** A legacy status report update meets a status_report-mode incident response, as the services verbs do. */
export function meetV1IncidentResponse(
  c: Context<{ Variables: Variables }>,
  statusReportId: number,
) {
  return meetIncidentResponseByStatusReport({
    ctx: v1ServiceCtx(c),
    input: { statusReportId },
  });
}
