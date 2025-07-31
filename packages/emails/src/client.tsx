/** @jsxImportSource react */

import { render } from "@react-email/render";
import { Resend } from "resend";
import FollowUpEmail from "../emails/followup";
import MonitorAlertEmail from "../emails/monitor-alert";
import type { MonitorAlertProps } from "../emails/monitor-alert";
import PageSubscriptionEmail from "../emails/page-subscription";
import type { PageSubscriptionProps } from "../emails/page-subscription";
import StatusReportEmail from "../emails/status-report";
import type { StatusReportProps } from "../emails/status-report";
import TeamInvitationEmail from "../emails/team-invitation";
import type { TeamInvitationProps } from "../emails/team-invitation";

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
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
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
    req: StatusReportProps & { to: string[] },
  ) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending status report update emails to ${req.to.join(", ")}`,
      );
      return;
    }

    try {
      const html = await render(<StatusReportEmail {...req} />);

      for (const recipients of chunk(req.to, 100)) {
        const result = await this.client.batch.send(
          recipients.map((subscriber) => ({
            from: `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
            subject: req.reportTitle,
            to: subscriber,
            html,
          })),
        );

        if (result.error) {
          console.error(
            `Error sending status report update batch to ${recipients}: ${result.error}`,
          );
        }
      }

      console.log(
        `Sent status report update email to ${req.to.length} subscribers`,
      );
    } catch (err) {
      console.error(
        `Error sending status report update email to ${req.to}`,
        err,
      );
    }
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
      const html = await render(<MonitorAlertEmail {...req} />);
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
}
