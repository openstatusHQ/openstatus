import { z } from "zod";

export const atlassianDescriptionEnum = z.enum([
  "All Systems Operational", // green
  "Major System Outage", // red
  "Partial System Outage", // orange
  "Minor Service Outage", // yellow
  "Degraded System Service", // yellow
  "Partially Degraded Service", // yellow
  "Service Under Maintenance", // blue
]);

export const externalStatus = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  external_id: z.string(),
  last_updated_at: z.string().datetime({ offset: true }),
  time_zone: z.string(),
  status_indicator: z.string(),
  status_description: atlassianDescriptionEnum,
  created_at: z.string(),
  updated_at: z.string().datetime(),
});

export const externalStatusArray = z.array(externalStatus);

export type ExternalStatus = z.infer<typeof externalStatus>;
export type ExternalStatusArray = z.infer<typeof externalStatusArray>;
export type AtlassianDescriptionEnum = z.infer<typeof atlassianDescriptionEnum>;

// ------------------------------

export function getClassname(status: ExternalStatus) {
  switch (status.status_description) {
    case "All Systems Operational":
      return "text-green-500";
    case "Major System Outage":
      return "text-red-500";
    case "Partial System Outage":
      return "text-orange-500";
    case "Minor Service Outage":
      return "text-yellow-500";
    case "Degraded System Service":
      return "text-yellow-500";
    case "Partially Degraded Service":
      return "text-yellow-500";
    case "Service Under Maintenance":
      return "text-blue-500";
    default:
      return "text-gray-500";
  }
}
