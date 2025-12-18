import { renderTemplateWithFooter } from "./_components";

export function renderMonitorPausedEmail() {
  return renderTemplateWithFooter(
    `
    <p>Hello 👋</p>
    <p>To save on cloud resources, your monitor(s) has been paused due to inactivity.</p>
    <p>If you would like to unpause your monitor(s), please login to your account or upgrade to a paid plan.</p>
    <p><a href="https://www.openstatus.dev/app">Login</a></p>
    <p>If you have any questions, please reply to this email.</p>
    <p>Thibault</p>
    <p>Check out our latest update <a href="https://www.openstatus.dev/changelog?ref=paused-email">here</a></p>
    `,
    "Your monitors have been paused",
  );
}
