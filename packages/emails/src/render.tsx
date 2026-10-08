/** @jsxRuntime automatic @jsxImportSource react */

import { render } from "react-email";

import MonitorDeactivationEmail, {
  type MonitorDeactivationProps,
  monitorDeactivationSubject,
} from "../emails/monitor-deactivation";
import MonitorPausedEmail, {
  MONITOR_PAUSED_SUBJECT,
  type MonitorPausedProps,
} from "../emails/monitor-paused";

export async function monitorDeactivationEmail(
  props: MonitorDeactivationProps,
) {
  return {
    subject: monitorDeactivationSubject(props),
    html: await render(<MonitorDeactivationEmail {...props} />),
  };
}

export async function monitorPausedEmail(props: MonitorPausedProps = {}) {
  return {
    subject: MONITOR_PAUSED_SUBJECT,
    html: await render(<MonitorPausedEmail {...props} />),
  };
}
