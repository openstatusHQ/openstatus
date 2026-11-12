/** @jsxRuntime automatic @jsxImportSource react */

import IncidentCommanderEmail, {
  type IncidentCommanderProps,
  incidentCommanderSubject,
} from "../emails/incident-commander";
import IncidentSlaNoticeEmail, {
  type IncidentSlaNoticeProps,
  incidentSlaNoticeSubject,
} from "../emails/incident-sla-notice";
import { sendEmail } from "./send";

const SYSTEM_FROM = "openstatus <notifications@notifications.openstatus.dev>";
const SUPPORT_EMAIL = "ping@openstatus.dev";

export async function sendIncidentCommander(
  req: IncidentCommanderProps & { to: string; idempotencyKey?: string },
) {
  const { to, idempotencyKey, ...props } = req;
  return sendEmail(
    {
      from: SYSTEM_FROM,
      reply_to: SUPPORT_EMAIL,
      to: [to],
      subject: incidentCommanderSubject(props),
      react: <IncidentCommanderEmail {...props} />,
    },
    { idempotencyKey },
  );
}

/** One email to every recipient; sends only in production. Returns the Resend id, throws on a Resend error. */
export async function sendIncidentSlaNotice(
  req: IncidentSlaNoticeProps & { to: string[]; idempotencyKey: string },
) {
  const { to, idempotencyKey, ...props } = req;
  if (to.length === 0) return;
  return sendEmail(
    {
      from: SYSTEM_FROM,
      reply_to: SUPPORT_EMAIL,
      to,
      subject: incidentSlaNoticeSubject(props),
      react: <IncidentSlaNoticeEmail {...props} />,
    },
    { idempotencyKey, throwOnError: true },
  );
}
