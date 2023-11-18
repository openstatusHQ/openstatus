import type { Tinybird } from "@chronark/zod-bird";

import {
  ingestEventSchema,
  pipeParameterData,
  pipeResponseData,
} from "./validation";

export function publishAuditLog(tb: Tinybird) {
  return tb.buildIngestEndpoint({
    datasource: "audit_log__v0",
    event: ingestEventSchema,
  });
}

export function getAuditLog(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "endpoint_audit_log__v0",
    parameters: pipeParameterData,
    data: pipeResponseData,
  });
}
