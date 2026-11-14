import {
  incidentSlaResolutionStops,
  incidentSlaResponseMets,
} from "@openstatus/db/src/schema/incident_sla_policies/constants";
import { incidentSeverity } from "@openstatus/db/src/schema/incidents/constants";
import { z } from "zod";

import { SlaPercentInput } from "../schemas";

// null and undefined both mean "off"; the range check runs in the verb so its
// message can name the field
const minutes = z.number().int().nullish();

const severityTargets = z.object({
  responseMinutes: minutes,
  resolutionMinutes: minutes,
  updateMinutes: minutes,
});

export const UpsertIncidentReportingInput = z.object({
  targets: z.partialRecord(z.enum(incidentSeverity), severityTargets),
  resolutionStop: z.enum(incidentSlaResolutionStops).default("mitigated"),
  responseMet: z.enum(incidentSlaResponseMets).default("acknowledged"),
  /** Percent of monthly fees per missed target; null removes it, omitted keeps it. */
  creditPerMissPct: SlaPercentInput.nullish(),
});
export type UpsertIncidentReportingInput = z.input<
  typeof UpsertIncidentReportingInput
>;
