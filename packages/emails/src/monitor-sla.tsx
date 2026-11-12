/** @jsxRuntime automatic @jsxImportSource react */

import MonitorSlaMissedEmail, {
  type MonitorSlaMissedProps,
  monitorSlaMissedSubject,
} from "../emails/monitor-sla-missed";
import { sendEmail } from "./send";

const SYSTEM_FROM = "openstatus <notifications@notifications.openstatus.dev>";
const SUPPORT_EMAIL = "ping@openstatus.dev";

/** Sends only in production (`delivery.enabled`); returns the Resend id, throws on a Resend error. */
export async function sendMonitorSlaMissed(
  req: MonitorSlaMissedProps & { to: string[]; idempotencyKey: string },
) {
  const { to, idempotencyKey, ...props } = req;
  if (to.length === 0) return;
  return sendEmail(
    {
      from: SYSTEM_FROM,
      reply_to: SUPPORT_EMAIL,
      to,
      subject: monitorSlaMissedSubject(props),
      react: <MonitorSlaMissedEmail {...props} />,
    },
    { idempotencyKey, throwOnError: true },
  );
}
