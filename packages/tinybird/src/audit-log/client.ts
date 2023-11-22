import type { Tinybird } from "@chronark/zod-bird";

import {
  ingestActionEventSchema,
  pipeActionResponseData,
} from "./action-validation";
import { pipeParameterData } from "./base-validation";

export class AuditLog {
  private readonly tb: Tinybird;

  constructor(opts: { tb: Tinybird }) {
    this.tb = opts.tb;
  }

  get publishAuditLog() {
    return this.tb.buildIngestEndpoint({
      datasource: "audit_log__v0",
      event: ingestActionEventSchema,
    });
  }

  get getAuditLog() {
    return this.tb.buildPipe({
      pipe: "endpoint_audit_log__v0",
      parameters: pipeParameterData,
      data: pipeActionResponseData,
    });
  }
}
