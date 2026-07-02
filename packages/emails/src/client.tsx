/** @jsxImportSource react */

import { Autosend } from "autosendjs";
import { type Duration, Effect, Schedule } from "effect";

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

export function statusReportSubject(req: {
  status: StatusReportProps["status"];
  reportTitle: string;
}): string {
  return req.status === "resolved"
    ? `RESOLVED: ${req.reportTitle}`
    : req.reportTitle;
}

// split an array into chunks of a given size.
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// parse a `"Name <email>"` (or bare `"email"`) string into autosend's address object.
export function toEmailAddress(input: string): {
  email: string;
  name?: string;
} {
  const match = input.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match
    ? { name: match[1] || undefined, email: match[2] }
    : { email: input.trim() };
}

export class EmailClient {
  public readonly client: Autosend;
  // Base delay for the per-batch send retry. Overridable so tests can run the
  // retry path without the real ~1s exponential sleep.
  private readonly retryBackoff: Duration.DurationInput;

  constructor(opts: { apiKey: string; retryBackoff?: Duration.DurationInput }) {
    this.client = new Autosend(opts.apiKey, { maxRetries: 1 });
    this.retryBackoff = opts.retryBackoff ?? "1000 millis";
  }

  public async sendFollowUp(req: { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending follow up email to ${req.to}`);
      return;
    }

    try {
      const result = await this.client.emails.send({
        from: toEmailAddress(
          "Thibault Le Ouay Ducasse <welcome@openstatus.dev>",
        ),
        replyTo: toEmailAddress(
          "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        ),
        subject: "How's it going with OpenStatus?",
        to: toEmailAddress(req.to),
        react: <FollowUpEmail />,
      });

      if (result.success) {
        console.log(`Sent follow up email to ${req.to}`);
        return;
      }

      throw new Error(result.error);
    } catch (err) {
      console.error(`Error sending follow up email to ${req.to}: ${err}`);
    }
  }

  public async sendFollowUpBatched(req: { to: string[] }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending follow up emails to ${req.to.join(", ")}`);
      return;
    }

    const result = await this.client.emails.bulk({
      from: toEmailAddress(
        "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
      ),
      subject: "How's it going with OpenStatus?",
      react: <FollowUpEmail />,
      recipients: req.to.map((email) => toEmailAddress(email)),
    });

    if (!result.success) {
      //  We only throw the error if we are rate limited
      if (result.statusCode === 429) {
        throw new Error(result.error);
      }
      //  Otherwise let's log the error and continue
      console.error(
        `Error sending follow up email to ${req.to}: ${result.error}`,
      );
      return;
    }

    console.log(`Sent follow up emails to ${req.to}`);
  }

  public async sendSlackFeedback(req: { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending slack feedback email to ${req.to}`);
      return;
    }

    try {
      const result = await this.client.emails.send({
        from: toEmailAddress(
          "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        ),
        replyTo: toEmailAddress(
          "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        ),
        subject: "How's the Slack app working for you?",
        to: toEmailAddress(req.to),
        react: <SlackFeedbackEmail />,
      });

      if (result.success) {
        console.log(`Sent slack feedback email to ${req.to}`);
        return;
      }

      throw new Error(result.error);
    } catch (err) {
      console.error(`Error sending slack feedback email to ${req.to}: ${err}`);
    }
  }

  public async sendSlackFeedbackBatched(req: { to: string[] }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending slack feedback emails to ${req.to.join(", ")}`);
      return;
    }

    const result = await this.client.emails.bulk({
      from: toEmailAddress(
        "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
      ),
      subject: "How's the Slack app working for you?",
      react: <SlackFeedbackEmail />,
      recipients: req.to.map((email) => toEmailAddress(email)),
    });

    if (!result.success) {
      if (result.statusCode === 429) {
        throw new Error(result.error);
      }
      console.error(
        `Error sending slack feedback email to ${req.to}: ${result.error}`,
      );
      return;
    }

    console.log(`Sent slack feedback emails to ${req.to}`);
  }

  public async sendStatusReportUpdate(
    req: Omit<StatusReportProps, "unsubscribeUrl" | "manageUrl"> & {
      subscribers: Array<{ email: string; token: string }>;
      pageSlug: string;
      customDomain?: string | null;
      // Base key for Resend idempotency. The per-batch retry below would
      // otherwise re-send the whole chunk if a request succeeds server-side
      // but the response is lost. Must be stable across retries.
      idempotencyKey?: string;
    },
  ) {
    const statusPageBaseUrl = req.customDomain
      ? `https://${req.customDomain}`
      : `https://${req.pageSlug}.openstatus.dev`;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending status report update emails to ${req.subscribers
          .map((s) => s.email)
          .join(", ")}`,
      );
      return;
    }

    const chunks = chunk(req.subscribers, 100);
    for (let i = 0; i < chunks.length; i++) {
      const recipients = chunks[i];
      // suffix the chunk index so a multi-batch send doesn't collide its
      // own chunks on a single shared key
      const batchKey = req.idempotencyKey
        ? `${req.idempotencyKey}:${i}`
        : undefined;
      const sendEmail = Effect.tryPromise({
        try: () =>
          this.client.emails.bulk({
            from: toEmailAddress(
              `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
            ),
            subject: statusReportSubject(req),
            // rendered once with placeholders; autosend substitutes per-recipient dynamicData
            react: (
              <StatusReportEmail
                {...req}
                unsubscribeUrl="{{unsubscribeUrl}}"
                manageUrl="{{manageUrl}}"
              />
            ),
            recipients: recipients.map((subscriber) => {
              const unsubscribeUrl = `${statusPageBaseUrl}/unsubscribe/${subscriber.token}`;
              const manageUrl = `${statusPageBaseUrl}/manage/${subscriber.token}`;
              return {
                ...toEmailAddress(subscriber.email),
                dynamicData: { unsubscribeUrl, manageUrl },
              };
            }),
          }),
        catch: (_unknown) =>
          new Error(
            `Error sending status report update batch to ${recipients.map(
              (r) => r.email,
            )}`,
          ),
      }).pipe(
        Effect.andThen((result) =>
          result.success
            ? Effect.succeed(result)
            : Effect.fail(new Error(result.error ?? "bulk failed")),
        ),
        Effect.retry({
          times: 3,
          schedule: Schedule.exponential(this.retryBackoff),
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
      const result = await this.client.emails.send({
        from: toEmailAddress(
          `${
            req.workspaceName ?? "OpenStatus"
          } <notifications@notifications.openstatus.dev>`,
        ),
        subject: `You've been invited to join ${
          req.workspaceName ?? "OpenStatus"
        }`,
        to: toEmailAddress(req.to),
        react: <TeamInvitationEmail {...req} />,
      });

      if (result.success) {
        console.log(`Sent team invitation email to ${req.to}`);
        return;
      }

      throw new Error(result.error);
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
        from: toEmailAddress(
          "OpenStatus <notifications@notifications.openstatus.dev>",
        ),
        subject: `${req.name}: ${req.type.toUpperCase()}`,
        to: toEmailAddress(req.to),
        html,
      });

      if (result.success) {
        console.log(`Sent monitor alert email to ${req.to}`);
        return;
      }

      throw new Error(result.error);
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
      const result = await this.client.emails.send({
        from: toEmailAddress(
          "Status Page <notifications@notifications.openstatus.dev>",
        ),
        subject: `Confirm your subscription to ${req.page}`,
        to: toEmailAddress(req.to),
        react: <PageSubscriptionEmail {...req} />,
      });

      if (result.success) {
        console.log(`Sent page subscription email to ${req.to}`);
        return;
      }

      throw new Error(result.error);
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
      const result = await this.client.emails.send({
        from: toEmailAddress(
          "Status Page <notifications@notifications.openstatus.dev>",
        ),
        subject: `Authenticate to ${req.page}`,
        to: toEmailAddress(req.to),
        react: <StatusPageMagicLinkEmail {...req} />,
      });

      if (result.success) {
        console.log(`Sent status page magic link email to ${req.to}`);
        return;
      }

      throw new Error(result.error);
    } catch (err) {
      console.error(`Error sending status page magic link to ${req.to}`, err);
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
    idempotencyKey?: string;
  }) {
    const statusPageBaseUrl = req.customDomain
      ? `https://${req.customDomain}`
      : `https://${req.pageSlug}.openstatus.dev`;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending maintenance notification emails to ${req.subscribers
          .map((s) => s.email)
          .join(", ")}`,
      );
      return;
    }

    const chunks = chunk(req.subscribers, 100);
    for (let i = 0; i < chunks.length; i++) {
      const recipients = chunks[i];
      const batchKey = req.idempotencyKey
        ? `${req.idempotencyKey}:${i}`
        : undefined;
      const sendEmail = Effect.tryPromise({
        try: () =>
          this.client.emails.bulk({
            from: toEmailAddress(
              `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
            ),
            subject: `Scheduled Maintenance: ${req.maintenanceTitle}`,
            // rendered once with placeholders; autosend substitutes per-recipient dynamicData
            react: (
              <StatusReportEmail
                pageTitle={req.pageTitle}
                reportTitle={req.maintenanceTitle}
                status="maintenance"
                date={`${req.from} - ${req.to}`}
                message={req.message}
                pageComponents={req.pageComponents}
                unsubscribeUrl="{{unsubscribeUrl}}"
                manageUrl="{{manageUrl}}"
              />
            ),
            recipients: recipients.map((subscriber) => {
              const unsubscribeUrl = `${statusPageBaseUrl}/unsubscribe/${subscriber.token}`;
              const manageUrl = `${statusPageBaseUrl}/manage/${subscriber.token}`;
              return {
                ...toEmailAddress(subscriber.email),
                dynamicData: { unsubscribeUrl, manageUrl },
              };
            }),
          }),
        catch: (_unknown) =>
          new Error(
            `Error sending maintenance notification batch to ${recipients.map(
              (r) => r.email,
            )}`,
          ),
      }).pipe(
        Effect.andThen((result) =>
          result.success
            ? Effect.succeed(result)
            : Effect.fail(new Error(result.error ?? "bulk failed")),
        ),
        Effect.retry({
          times: 3,
          schedule: Schedule.exponential(this.retryBackoff),
        }),
      );
      await Effect.runPromise(sendEmail).catch(console.error);
    }

    console.log(
      `Sent maintenance notification email to ${req.subscribers.length} subscribers`,
    );
  }
}
