import { AuditLog, Tinybird } from "@openstatus/tinybird";

import { env } from "../env";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export const checkerAudit = new AuditLog({ tb });
