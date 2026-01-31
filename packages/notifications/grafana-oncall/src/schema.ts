import { grafanaOncallDataSchema } from "@openstatus/db/src/schema";
import { z } from "zod";

export const GrafanaOncallSchema = grafanaOncallDataSchema;

export const GrafanaOncallPayload = z.object({
  alert_uid: z.string(),
  title: z.string(),
  message: z.string().optional(),
  state: z.enum(["alerting", "ok"]),
  link_to_upstream_details: z.string().optional(),
});
