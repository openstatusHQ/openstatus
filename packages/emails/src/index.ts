export { default as FollowUpEmail } from "../emails/followup";
export { default as SubscribeEmail } from "../emails/subscribe";
export { default as WelcomeEmail } from "../emails/welcome";
export { default as TeamInvitationEmail } from "../emails/team-invitation";
export { default as MonitorPausedEmail } from "../emails/monitor-paused";
export { default as MonitorDeactivationEmail } from "../emails/monitor-deactivation";

export { sendEmail, sendEmailHtml, sendBatchEmailHtml } from "./send";

export { EmailClient } from "./client";
