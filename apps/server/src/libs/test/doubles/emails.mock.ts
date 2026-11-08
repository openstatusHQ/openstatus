// Test double for @openstatus/emails, swapped in via --import-map: records the
// incident commander email instead of calling Resend; everything else is real.
import { sendIncidentCommander as realSendIncidentCommander } from "@openstatus/emails-real";

export * from "@openstatus/emails-real";

type IncidentCommanderEmail = Parameters<typeof realSendIncidentCommander>[0];

const g = globalThis as {
  __incidentCommanderEmails?: IncidentCommanderEmail[];
};
if (!g.__incidentCommanderEmails) g.__incidentCommanderEmails = [];

export const incidentCommanderEmails: IncidentCommanderEmail[] =
  g.__incidentCommanderEmails;

export function sendIncidentCommander(
  req: IncidentCommanderEmail,
): Promise<void> {
  incidentCommanderEmails.push(req);
  return Promise.resolve();
}
