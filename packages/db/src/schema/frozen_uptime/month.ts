import { z } from "zod";

// YYYY-MM-01, UTC first-of-month
export const frozenMonitorUptimeMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "expected YYYY-MM-01");
