/** @jsxRuntime automatic @jsxImportSource react */

import MonitorSlaMissedEmail, {
  type MonitorSlaMissedProps,
  monitorSlaMissedSubject,
} from "../emails/monitor-sla-missed";
import { sendEmail } from "./send";

const SYSTEM_FROM = "openstatus <notifications@notifications.openstatus.dev>";
const SUPPORT_EMAIL = "ping@openstatus.dev";

const RESEND_MAX_RECIPIENTS = 50;

/** Sends only in production (`delivery.enabled`), 50 owners per email; returns the first Resend id, throws on a Resend error. */
export async function sendMonitorSlaMissed(
  req: MonitorSlaMissedProps & { to: string[]; idempotencyKey: string },
) {
  const { to, idempotencyKey, ...props } = req;
  // chunk keys must name the same owners on a retry
  const recipients = [...to].sort();
  let first: string | undefined;
  for (let i = 0; i < recipients.length; i += RESEND_MAX_RECIPIENTS) {
    const id = await sendEmail(
      {
        from: SYSTEM_FROM,
        reply_to: SUPPORT_EMAIL,
        to: recipients.slice(i, i + RESEND_MAX_RECIPIENTS),
        subject: monitorSlaMissedSubject(props),
        react: <MonitorSlaMissedEmail {...props} />,
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
