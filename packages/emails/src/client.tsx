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

export class EmailClient {
  public readonly client: Resend;

  constructor(opts: { apiKey: string }) {
    this.client = new Resend(opts.apiKey);
  }

  public async sendFollowUp(req: { to: string }) {
    if (process.env.NODE_ENV === "development") return;

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

  public async sendStatusReportUpdate(req: StatusReportProps & { to: string }) {
    if (process.env.NODE_ENV === "development") return;

    try {
      const html = await render(<StatusReportEmail {...req} />);
      const result = await this.client.emails.send({
        from: `${req.pageTitle} <notifications@openstatus.dev>`,
        subject: req.reportTitle,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent status report update email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(
        `Error sending status report update email to ${req.to}: ${err}`,
      );
    }
  }

  public async sendTeamInvitation(req: TeamInvitationProps & { to: string }) {
    if (process.env.NODE_ENV === "development") return;

    try {
      const html = await render(<TeamInvitationEmail {...req} />);
      const result = await this.client.emails.send({
        from: `${req.workspaceName ?? "OpenStatus"} <notifications@openstatus.dev>`,
        subject: `You've been invited to join ${req.workspaceName ?? "OpenStatus"}`,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent team invitation email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending team invitation email to ${req.to}: ${err}`);
    }
  }

  public async sendMonitorAlert(req: MonitorAlertProps & { to: string }) {
    if (process.env.NODE_ENV === "development") return;

    try {
      const html = await render(<MonitorAlertEmail {...req} />);
      const result = await this.client.emails.send({
        from: "OpenStatus <notifications@openstatus.dev>",
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
      console.error(`Error sending monitor alert to ${req.to}: ${err}`);
    }
  }

  public async sendPageSubscription(
    req: PageSubscriptionProps & { to: string },
  ) {
    if (process.env.NODE_ENV === "development") return;

    try {
      const html = await render(<PageSubscriptionEmail {...req} />);
      const result = await this.client.emails.send({
        from: `${req.page} <notifications@openstatus.dev>`,
        subject: "Status page subscription",
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent page subscription email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending page subscription to ${req.to}: ${err}`);
    }
  }
}
