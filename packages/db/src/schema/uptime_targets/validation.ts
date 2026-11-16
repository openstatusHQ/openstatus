import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { uptimeTarget } from "./uptime_target";

export const selectUptimeTargetSchema = createSelectSchema(uptimeTarget);

export type UptimeTarget = z.infer<typeof selectUptimeTargetSchema>;
