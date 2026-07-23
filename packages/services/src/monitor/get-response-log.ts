import { db as defaultDb } from "@openstatus/db";

import { type ServiceContext, defaultTb } from "../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import type { ResponseLogListItem } from "./list-response-logs";
import { redactSensitiveHeaders } from "./response-logs-internal";
import { GetResponseLogInput } from "./schemas";

export type ResponseLogDetail = ResponseLogListItem & {
  url: string;
  error: boolean;
  message: string | null;
  /** Already redacted at the service boundary. */
  headers: Record<string, string>;
  assertions: string | null;
};

export async function getResponseLog(args: {
  ctx: ServiceContext;
  input: GetResponseLogInput;
}): Promise<ResponseLogDetail> {
  const { ctx } = args;
  const input = GetResponseLogInput.parse(args.input);
  if (!ctx.workspace.limits["response-logs"]) {
    throw new ForbiddenError("Response logs are not enabled on this plan.");
  }
  const db = ctx.db ?? defaultDb;

  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  if (record.jobType !== "http") {
    throw new ValidationError(
      `getResponseLog only supports HTTP monitors (got '${record.jobType}').`,
    );
  }

  const result = await (ctx.tb ?? defaultTb).httpGetBiweekly({
    id: input.logId,
    monitorId: String(record.id),
  });
  const log = result.data[0];
  if (!log) throw new NotFoundError("response_log", input.logId);

  return {
    id: log.id ?? null,
    monitorId: log.monitorId,
    region: log.region,
    requestStatus: log.requestStatus ?? null,
    trigger: log.trigger ?? null,
    statusCode: log.statusCode ?? null,
    latency: log.latency,
    cronTimestamp: log.cronTimestamp,
    timestamp: log.timestamp,
    timing: log.timing
      ? {
          dns: log.timing.dns,
          connect: log.timing.connect,
          tls: log.timing.tls,
          ttfb: log.timing.ttfb,
          transfer: log.timing.transfer,
        }
      : null,
    url: log.url,
    error: log.error,
    message: log.message ?? null,
    headers: redactSensitiveHeaders(log.headers),
    assertions: log.assertions ?? null,
  };
}
