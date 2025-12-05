import { renderTemplateWithFooter } from "./_components";

interface MonitorDeactivationEmailProps {
  deactivateAt: Date;
}

export function renderMonitorDeactivationEmail({
  deactivateAt,
}: MonitorDeactivationEmailProps) {
  return renderTemplateWithFooter(
    `
    <p>Hello 👋</p>
    <p>To save on cloud resources and avoid having stale monitors. We are deactivating monitors for free account if you have not logged in for the last 2 months.</p>
    <p>Your monitor(s) will be deactivated on <strong>${deactivateAt.toDateString()}</strong>.</p>
    <p>If you would like to keep your monitor(s) active, please login to your account or upgrade to a paid plan.</p>
    <p><a href="https://www.openstatus.dev/app">Login</a></p>
    <p>If you have any questions, please reply to this email.</p>
    <p>Thibault</p>
    <p>Check out our latest update <a href="https://www.openstatus.dev/changelog?ref=paused-email">here</a></p>
    `,
    "Login to your OpenStatus account to keep your monitors active",
  );
}
