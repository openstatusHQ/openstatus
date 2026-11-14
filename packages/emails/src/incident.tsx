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

const RESEND_MAX_RECIPIENTS = 50;

/** One email per 50 recipients; sends only in production. Returns the first Resend id, throws on a Resend error. */
export async function sendIncidentSlaNotice(
  req: IncidentSlaNoticeProps & { to: string[]; idempotencyKey: string },
) {
  const { to, idempotencyKey, ...props } = req;
  let first: string | undefined;
  for (let i = 0; i < to.length; i += RESEND_MAX_RECIPIENTS) {
    const id = await sendEmail(
      {
        from: SYSTEM_FROM,
        reply_to: SUPPORT_EMAIL,
        to: to.slice(i, i + RESEND_MAX_RECIPIENTS),
        subject: incidentSlaNoticeSubject(props),
        react: <IncidentSlaNoticeEmail {...props} />,
      },
      {
        idempotencyKey: `${idempotencyKey}:${i / RESEND_MAX_RECIPIENTS}`,
        throwOnError: true,
      },
    );
    first ??= id;
  }
  return first;
}
