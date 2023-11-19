import type { Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import {
  ingestEventSchema,
  pipeParameterData,
  pipeResponseData,
} from "./validation";

export class AuditLog<T extends z.ZodRawShape> {
  private readonly tb: Tinybird;
  private readonly metadataSchema: z.ZodObject<T>;
  private readonly datasource: string;
  private readonly pipe: string;

  constructor(opts: {
    tb: Tinybird;
    name: string;
    metadataSchema: z.ZodObject<T>;
  }) {
    this.tb = opts.tb;
    this.metadataSchema = opts.metadataSchema;
    this.datasource = `${opts.name}`;
    this.pipe = `endpoint_${opts.name}`;
  }

  private metadataIngestExtender() {
    return ingestEventSchema.merge(
      z.object({
        metadata: this.metadataSchema.transform((val) => JSON.stringify(val)),
      }),
    );
  }

  private metadataPipeExtender() {
    return pipeResponseData.merge(
      z.object({
        metadata: z.preprocess(
          (val) => (val ? JSON.parse(String(val)) : undefined),
          this.metadataSchema,
        ),
      }),
    );
  }

  get publishAuditLog() {
    return this.tb.buildIngestEndpoint({
      datasource: this.datasource,
      event: this.metadataIngestExtender(),
    });
  }

  get getAuditLog() {
    return this.tb.buildPipe({
      pipe: this.pipe,
      parameters: pipeParameterData,
      data: this.metadataPipeExtender(),
    });
  }
}
