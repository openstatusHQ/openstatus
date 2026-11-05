/** @jsxRuntime automatic @jsxImportSource react */

import IncidentCommanderEmail, {
  type IncidentCommanderProps,
  incidentCommanderSubject,
} from "../emails/incident-commander";
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
