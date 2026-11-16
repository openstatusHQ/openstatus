import {
  incidentTargetResolutionStops,
  incidentTargetResponseMets,
} from "@openstatus/db/src/schema/incident_response_targets/constants";
import { incidentSeverity } from "@openstatus/db/src/schema/incidents/constants";
import { z } from "zod";

// null and undefined both mean "off"; the range check runs in the verb so its
// message can name the field
const minutes = z.number().int().nullish();

const severityTargets = z.object({
  responseMinutes: minutes,
  resolutionMinutes: minutes,
});

export const UpsertIncidentResponseTargetInput = z.object({
  targets: z.partialRecord(z.enum(incidentSeverity), severityTargets),
  resolutionStop: z.enum(incidentTargetResolutionStops).default("mitigated"),
  responseMet: z.enum(incidentTargetResponseMets).default("acknowledged"),
});
export type UpsertIncidentResponseTargetInput = z.input<
  typeof UpsertIncidentResponseTargetInput
>;
