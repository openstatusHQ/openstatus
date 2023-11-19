import { z } from "zod";

import { AuditLog, Tinybird } from "@openstatus/tinybird";

import { env } from "../env";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const checkerAuditName = "checker_audit_log";

const statusUnion = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.instanceof(Error) }),
]);

const checkerMetadataSchema = z.object({
  region: z.string(),
  // details: z.string().optional(),
  // statusUnion,
});

export const checkerAudit = new AuditLog({
  tb,
  name: checkerAuditName,
  metadataSchema: checkerMetadataSchema,
});
