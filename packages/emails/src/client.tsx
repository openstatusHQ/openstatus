/** @jsxImportSource react */

import { render } from "@react-email/render";
import { Effect, Schedule } from "effect";
import { Resend } from "resend";
import FollowUpEmail from "../emails/followup";
import type { MonitorAlertProps } from "../emails/monitor-alert";
import PageSubscriptionEmail from "../emails/page-subscription";
import type { PageSubscriptionProps } from "../emails/page-subscription";
import StatusPageMagicLinkEmail from "../emails/status-page-magic-link";
import type { StatusPageMagicLinkProps } from "../emails/status-page-magic-link";
import StatusReportEmail from "../emails/status-report";
import type { StatusReportProps } from "../emails/status-report";
import TeamInvitationEmail from "../emails/team-invitation";
import type { TeamInvitationProps } from "../emails/team-invitation";
import { monitorAlertEmail } from "../hotfix/monitor-alert";

// split an array into chunks of a given size.
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export class EmailClient {
  public readonly client: Resend;

  constructor(opts: { apiKey: string }) {
    this.client = new Resend(opts.apiKey);
  }

  public async sendFollowUp(req: { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending follow up email to ${req.to}`);
      return;
    }

    try {
      const html = await render(<FollowUpEmail />);
      const result = await this.client.emails.send({
        from: "Thibault Le Ouay Ducasse <welcome@openstatus.dev>",
        replyTo: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's it going with OpenStatus?",
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent follow up email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending follow up email to ${req.to}: ${err}`);
    }
  }

  public async sendFollowUpBatched(req: { to: string[] }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending follow up emails to ${req.to.join(", ")}`);
      return;
    }

    const html = await render(<FollowUpEmail />);
    const result = await this.client.batch.send(
      req.to.map((subscriber) => ({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's it going with OpenStatus?",
        to: subscriber,
        html,
      })),
    );

    if (result.error) {
      //  We only throw the error if we are rate limited
      if (result.error?.name === "rate_limit_exceeded") {
        throw result.error;
      }
      //  Otherwise let's log the error and continue
      console.error(
        `Error sending follow up email to ${req.to}: ${result.error}`,
      );
      return;
    }

    console.log(`Sent follow up emails to ${req.to}`);
  }

  public async sendStatusReportUpdate(
    req: StatusReportProps & {
      subscribers: Array<{ email: string; token: string }>;
      baseUrl?: string;
    },
  ) {
    const baseUrl = req.baseUrl ?? "https://api.openstatus.dev";

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending status report update emails to ${req.subscribers.map((s) => s.email).join(", ")}`,
      );
      return;
    }

    for (const recipients of chunk(req.subscribers, 100)) {
      const sendEmail = Effect.tryPromise({
        try: () =>
          this.client.batch.send(
            recipients.map((subscriber) => {
              const unsubscribeUrl = `${baseUrl}/public/unsubscribe/${subscriber.token}`;
              return {
                from: `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
                subject: req.reportTitle,
                to: subscriber.email,
                react: <StatusReportEmail {...req} unsubscribeUrl={unsubscribeUrl} />,
                headers: {
                  "List-Unsubscribe": `<${unsubscribeUrl}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
              };
            }),
          ),
        catch: (_unknown) =>
          new Error(
            `Error sending status report update batch to ${recipients.map((r) => r.email)}`,
          ),
      }).pipe(
        Effect.andThen((result) =>
          result.error ? Effect.fail(result.error) : Effect.succeed(result),
        ),
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
      const html = await render(<TeamInvitationEmail {...req} />);
      const result = await this.client.emails.send({
        from: `${
          req.workspaceName ?? "OpenStatus"
        } <notifications@notifications.openstatus.dev>`,
        subject: `You've been invited to join ${
          req.workspaceName ?? "OpenStatus"
        }`,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent team invitation email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending team invitation email to ${req.to}`, err);
    }
  }

  public async sendMonitorAlert(req: MonitorAlertProps & { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending monitor alert email to ${req.to}`);
      return;
    }

    try {
      // const html = await render(<MonitorAlertEmail {...req} />);
      const html = monitorAlertEmail(req);
      const result = await this.client.emails.send({
        from: "OpenStatus <notifications@notifications.openstatus.dev>",
        subject: `${req.name}: ${req.type.toUpperCase()}`,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent monitor alert email to ${req.to}`);
        return;
      }

      throw result.error;
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
      const html = await render(<PageSubscriptionEmail {...req} />);
      const result = await this.client.emails.send({
        from: "Status Page <notifications@notifications.openstatus.dev>",
        subject: `Confirm your subscription to ${req.page}`,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent page subscription email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending page subscription to ${req.to}`, err);
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
      const html = await render(<StatusPageMagicLinkEmail {...req} />);
      const result = await this.client.emails.send({
        from: "Status Page <notifications@notifications.openstatus.dev>",
        subject: `Authenticate to ${req.page}`,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent status page magic link email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending status page magic link to ${req.to}`, err);
    }
  }
}
