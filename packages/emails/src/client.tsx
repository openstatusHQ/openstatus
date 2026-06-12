/** @jsxImportSource react */

import { Effect, Schedule } from "effect";
import { render } from "react-email";
import { Resend } from "resend";

import FollowUpEmail from "../emails/followup";
import type { MonitorAlertProps } from "../emails/monitor-alert";
import PageSubscriptionEmail from "../emails/page-subscription";
import type { PageSubscriptionProps } from "../emails/page-subscription";
import SlackFeedbackEmail from "../emails/slack-feedback";
import StatusPageMagicLinkEmail from "../emails/status-page-magic-link";
import type { StatusPageMagicLinkProps } from "../emails/status-page-magic-link";
import StatusReportEmail from "../emails/status-report";
import type { StatusReportProps } from "../emails/status-report";
import TeamInvitationEmail from "../emails/team-invitation";
import type { TeamInvitationProps } from "../emails/team-invitation";
import { monitorAlertEmail } from "../hotfix/monitor-alert";
import nodemailer from "nodemailer";
import { env } from "./env";

// split an array into chunks of a given size.
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export type EmailClientOptions = "smtp" | "resend";

export class EmailClient {
  private type: EmailClientOptions;
  private resendClient?: Resend;
  private smtpTransporter?: nodemailer.Transporter;

  constructor(){
    if(env.SMTP_HOST) {
      this.type = "smtp";
      this.smtpTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) || 587 : 587,
        auth: env.SMTP_USER && env.SMTP_PASS ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        } : undefined,
      });
    }
    else if (env.RESEND_API_KEY) {
      this.type = "resend";
      this.resendClient = new Resend(env.RESEND_API_KEY);
    }
    else{
      throw new Error("Either RESEND_API_KEY or SMTP_HOST must be provided in the environment variables.");
    }
  }

  private async sendSingle(opts:{
    from: string;
    to: string[];
    subject: string;
    react: React.JSX.Element;
    reply_to?: string;
  }):Promise<void>{
      const html = await render(opts.react);
      if(this.type === "smtp"){
        if (!this.smtpTransporter) throw new Error("SMTP transporter not initialized");
        await this.smtpTransporter.sendMail({
          from: env.SMTP_FROM || opts.from,
          to: opts.to.join(", "),
          subject: opts.subject,
          html,
          replyTo: opts.reply_to,
        });
      }
      else{
        if (!this.resendClient) throw new Error("Resend client not initialized");
        await this.resendClient.emails.send({
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
          html,
          replyTo: opts.reply_to,
        });
      }
  }

  private async sendBatch(opts:{
    from: string;
    to: string;
    subject: string;
    html: string;
    reply_to?: string;
  }[]):Promise<void>{
      if(this.type === "smtp"){
        if (!this.smtpTransporter) throw new Error("SMTP transporter not initialized");
        const transporter = this.smtpTransporter; 
        const sendEmailPromises = opts.map(async (email) => {
          return transporter.sendMail({
            from: env.SMTP_FROM || email.from,
            to: email.to,
            subject: email.subject,
            html: email.html,
            replyTo: email.reply_to,
          });
        });
        await Promise.all(sendEmailPromises);
      }
      else{
        if (!this.resendClient) throw new Error("Resend client not initialized");
        const client = this.resendClient;
        const chunks = chunk(opts, 100); // Resend batch limit
        for(const batch of chunks){
          // resendClient is guaranteed to be set when this.type === "resend"
          await client.batch.send(batch)
      }
    }
  }

  public async sendFollowUp(req: { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending follow up email to ${req.to}`);
      return;
    }

    try {
      await this.sendSingle({
        from: "Thibault Le Ouay Ducasse <welcome@openstatus.dev>",
        reply_to: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's it going with OpenStatus?",
        to: [req.to],
        react: <FollowUpEmail />,
      })
      console.log(`Sent follow up email to ${req.to}`);
      return;
    } catch (err) {
      console.error(`Error sending follow up email to ${req.to}: ${err}`);
      return;
    }
  }

  public async sendFollowUpBatched(req: { to: string[] }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending follow up emails to ${req.to.join(", ")}`);
      return;
    }

    const html = await render(<FollowUpEmail />);
    
    try{
        await this.sendBatch(req.to.map((subscriber) => ({
          from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
          subject: "How's it going with OpenStatus?",
          to: subscriber,
          html,
      })))
      console.log(`Sent follow up emails to ${req.to}`);
      return;
    }catch(err){
      if(this.type === "resend" && err instanceof Error && err.name === "rate_limit_exceeded"){
        throw err;
      }
      console.error(`Error sending follow up emails to ${req.to}: ${err}`);
      return;
    }
  }

  public async sendSlackFeedback(req: { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending slack feedback email to ${req.to}`);
      return;
    }

    try {
      await this.sendSingle({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        reply_to: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's the Slack app working for you?",
        to: [req.to],
        react: <SlackFeedbackEmail />,
      });
      console.log(`Sent slack feedback email to ${req.to}`);
      return;
    } catch (err) {
      console.error(`Error sending slack feedback email to ${req.to}: ${err}`);
      return;
    }
  }

  public async sendSlackFeedbackBatched(req: { to: string[] }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending slack feedback emails to ${req.to.join(", ")}`);
      return;
    }

    const html = await render(<SlackFeedbackEmail />);

    try {
      await this.sendBatch(
        req.to.map((subscriber) => ({
          from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
          subject: "How's the Slack app working for you?",
          to: subscriber,
          html,
        })),
      );
      console.log(`Sent slack feedback emails to ${req.to}`);
      return;
    } catch (err) {
      if (this.type === "resend" && err instanceof Error && err.name === "rate_limit_exceeded") {
        throw err;
      }
      console.error(`Error sending slack feedback email to ${req.to}: ${err}`);
      return;
    }
  }

  public async sendStatusReportUpdate(
    req: Omit<StatusReportProps, "unsubscribeUrl" | "manageUrl"> & {
      subscribers: Array<{ email: string; token: string }>;
      pageSlug: string;
      customDomain?: string | null;
    },
  ) {
    const statusPageBaseUrl = req.customDomain
      ? `https://${req.customDomain}`
      : `https://${req.pageSlug}.openstatus.dev`;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending status report update emails to ${req.subscribers.map((s) => s.email).join(", ")}`,
      );
      return;
    }

    for (const recipients of chunk(req.subscribers, 100)) {
      const rendered = await Promise.all(
        recipients.map(async (subscriber) => {
          const unsubscribeUrl = `${statusPageBaseUrl}/unsubscribe/${subscriber.token}`;
          const manageUrl = `${statusPageBaseUrl}/manage/${subscriber.token}`;
          const html = await render(
            <StatusReportEmail
              {...req}
              unsubscribeUrl={unsubscribeUrl}
              manageUrl={manageUrl}
            />,
          );
          return {
            from: `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
            subject: req.reportTitle,
            to: subscriber.email,
            html,
          };
        }),
      );

      const sendEmail = Effect.tryPromise({
        try: () => this.sendBatch(rendered),
        catch: (_unknown) =>
          new Error(
            `Error sending status report update batch to ${recipients.map((r) => r.email)}`,
          ),
      }).pipe(
        Effect.retry({
          times: 3,
          schedule: Schedule.exponential("1000 millis"),
        }),
      );
      await Effect.runPromise(sendEmail).catch(console.error);
    }

    console.log(
      `Sent status report update email to ${req.subscribers.length} subscribers`,
    );
  }

  public async sendTeamInvitation(req: TeamInvitationProps & { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending team invitation email to ${req.to}`);
      return;
    }

    try {
      await this.sendSingle({
        from: `${req.workspaceName ?? "OpenStatus"} <notifications@notifications.openstatus.dev>`,
        subject: `You've been invited to join ${req.workspaceName ?? "OpenStatus"}`,
        to: [req.to],
        react: <TeamInvitationEmail {...req} />,
      });
      console.log(`Sent team invitation email to ${req.to}`);
      return;
    } catch (err) {
      console.error(`Error sending team invitation email to ${req.to}`, err);
      return;
    }
  }

  public async sendMonitorAlert(req: MonitorAlertProps & { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending monitor alert email to ${req.to}`);
      return;
    }

    try {
      const html = monitorAlertEmail(req);
      await this.sendBatch([
        {
          from: "OpenStatus <notifications@notifications.openstatus.dev>",
          subject: `${req.name}: ${req.type.toUpperCase()}`,
          to: req.to,
          html,
        },
      ]);
      console.log(`Sent monitor alert email to ${req.to}`);
      return;
    } catch (err) {
      console.error(`Error sending monitor alert to ${req.to}`, err);
      throw err;
    }
  }

  public async sendPageSubscription(
    req: PageSubscriptionProps & { to: string },
  ) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending page subscription email to ${req.to}`);
      return;
    }

    try {
      await this.sendSingle({
        from: "Status Page <notifications@notifications.openstatus.dev>",
        subject: `Confirm your subscription to ${req.page}`,
        to: [req.to],
        react: <PageSubscriptionEmail {...req} />,
      });
      console.log(`Sent page subscription email to ${req.to}`);
      return;
    } catch (err) {
      console.error(`Error sending page subscription to ${req.to}`, err);
      return;
    }
  }

  public async sendStatusPageMagicLink(
    req: StatusPageMagicLinkProps & { to: string },
  ) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending status page magic link email to ${req.to}`);
      console.log(`>>> Magic Link: ${req.link}`);
      return;
    }

    try {
      await this.sendSingle({
        from: "Status Page <notifications@notifications.openstatus.dev>",
        subject: `Authenticate to ${req.page}`,
        to: [req.to],
        react: <StatusPageMagicLinkEmail {...req} />,
      });
      console.log(`Sent status page magic link email to ${req.to}`);
      return;
    } catch (err) {
      console.error(`Error sending status page magic link to ${req.to}`, err);
      return;
    }
  }

  public async sendMaintenanceNotification(req: {
    subscribers: Array<{ email: string; token: string }>;
    pageTitle: string;
    pageSlug: string;
    customDomain?: string | null;
    maintenanceTitle: string;
    message: string;
    from: string;
    to: string;
    pageComponents: string[];
  }) {
    const statusPageBaseUrl = req.customDomain
      ? `https://${req.customDomain}`
      : `https://${req.pageSlug}.openstatus.dev`;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending maintenance notification emails to ${req.subscribers.map((s) => s.email).join(", ")}`,
      );
      return;
    }

    for (const recipients of chunk(req.subscribers, 100)) {
      const rendered = await Promise.all(
        recipients.map(async (subscriber) => {
          const unsubscribeUrl = `${statusPageBaseUrl}/unsubscribe/${subscriber.token}`;
          const manageUrl = `${statusPageBaseUrl}/manage/${subscriber.token}`;
          const html = await render(
            <StatusReportEmail
              pageTitle={req.pageTitle}
              reportTitle={req.maintenanceTitle}
              status="maintenance"
              date={`${req.from} - ${req.to}`}
              message={req.message}
              pageComponents={req.pageComponents}
              unsubscribeUrl={unsubscribeUrl}
              manageUrl={manageUrl}
            />,
          );
          return {
            from: `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
            subject: `Scheduled Maintenance: ${req.maintenanceTitle}`,
            to: subscriber.email,
            html,
          };
        }),
      );

      const sendEmail = Effect.tryPromise({
        try: () => this.sendBatch(rendered),
        catch: (_unknown) =>
          new Error(
            `Error sending maintenance notification batch to ${recipients.map((r) => r.email)}`,
          ),
      }).pipe(
        Effect.retry({
          times: 3,
          schedule: Schedule.exponential("1000 millis"),
        }),
      );
      await Effect.runPromise(sendEmail).catch(console.error);
    }

    console.log(
      `Sent maintenance notification email to ${req.subscribers.length} subscribers`,
    );
  }
}
