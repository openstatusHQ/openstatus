/** @jsxRuntime automatic @jsxImportSource react */

import { statusLabel } from "@openstatus/utils";
import { type Duration, Effect, Schedule } from "effect";
import { render } from "react-email";
import { Resend } from "resend";

import FollowUpEmail from "../emails/followup";
import type { MonitorAlertProps } from "../emails/monitor-alert";
import PageSubscriptionEmail from "../emails/page-subscription";
import type { PageSubscriptionProps } from "../emails/page-subscription";
import PrivateLocationAlertEmail from "../emails/private-location-alert";
import type { PrivateLocationAlertProps } from "../emails/private-location-alert";
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
  if (req.status === "resolved") return `RESOLVED: ${req.reportTitle}`;
  if (req.status === "maintenance")
    return `${statusLabel("maintenance")}: ${req.reportTitle}`;
  return req.reportTitle;
}

// Deterministic Resend rejections: retrying the identical request can never
// succeed (e.g. 409 invalid_idempotent_request when a key is reused with a
// different body), it only burns the backoff and re-logs the error.
const NON_RETRYABLE_RESEND_ERRORS = new Set<string>([
  "invalid_idempotent_request",
  "invalid_idempotency_key",
  "validation_error",
]);

function isRetryableSendError(error: { name: string }): boolean {
  return !NON_RETRYABLE_RESEND_ERRORS.has(error.name);
}

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
  // Base delay for the per-batch send retry. Overridable so tests can run the
  // retry path without the real ~1s exponential sleep.
  private readonly retryBackoff: Duration.DurationInput;

  constructor(opts: { apiKey: string; retryBackoff?: Duration.DurationInput }) {
    this.client = new Resend(opts.apiKey);
    this.retryBackoff = opts.retryBackoff ?? "1000 millis";
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

  public async sendSlackFeedback(req: { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending slack feedback email to ${req.to}`);
      return;
    }

    try {
      const html = await render(<SlackFeedbackEmail />);
      const result = await this.client.emails.send({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        replyTo: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's the Slack app working for you?",
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent slack feedback email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending slack feedback email to ${req.to}: ${err}`);
    }
  }

  public async sendSlackFeedbackBatched(req: { to: string[] }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending slack feedback emails to ${req.to.join(", ")}`);
      return;
    }

    const html = await render(<SlackFeedbackEmail />);
    const result = await this.client.batch.send(
      req.to.map((subscriber) => ({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's the Slack app working for you?",
        to: subscriber,
        html,
      })),
    );

    if (result.error) {
      if (result.error?.name === "rate_limit_exceeded") {
        throw result.error;
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
          this.client.batch.send(
            recipients.map((subscriber) => {
              const unsubscribeUrl = `${statusPageBaseUrl}/unsubscribe/${subscriber.token}`;
              const manageUrl = `${statusPageBaseUrl}/manage/${subscriber.token}`;
              return {
                from: `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
                subject: statusReportSubject(req),
                to: subscriber.email,
                react: (
                  <StatusReportEmail
                    {...req}
                    unsubscribeUrl={unsubscribeUrl}
                    manageUrl={manageUrl}
                  />
                ),
              };
            }),
            batchKey ? { idempotencyKey: batchKey } : undefined,
          ),
        catch: (_unknown) =>
          new Error(
            `Error sending status report update batch to ${recipients.map(
              (r) => r.email,
            )}`,
          ),
      }).pipe(
        Effect.andThen((result) =>
          result.error ? Effect.fail(result.error) : Effect.succeed(result),
        ),
        Effect.retry({
          times: 3,
          schedule: Schedule.exponential(this.retryBackoff),
          while: isRetryableSendError,
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
          this.client.batch.send(
            recipients.map((subscriber) => {
              const unsubscribeUrl = `${statusPageBaseUrl}/unsubscribe/${subscriber.token}`;
              const manageUrl = `${statusPageBaseUrl}/manage/${subscriber.token}`;
              return {
                from: `${req.pageTitle} <notifications@notifications.openstatus.dev>`,
                subject: `Scheduled Maintenance: ${req.maintenanceTitle}`,
                to: subscriber.email,
                react: (
                  <StatusReportEmail
                    pageTitle={req.pageTitle}
                    reportTitle={req.maintenanceTitle}
                    status="maintenance"
                    date={`${req.from} - ${req.to}`}
                    message={req.message}
                    pageComponents={req.pageComponents}
                    unsubscribeUrl={unsubscribeUrl}
                    manageUrl={manageUrl}
                  />
                ),
              };
            }),
            batchKey ? { idempotencyKey: batchKey } : undefined,
          ),
        catch: (_unknown) =>
          new Error(
            `Error sending maintenance notification batch to ${recipients.map(
              (r) => r.email,
            )}`,
          ),
      }).pipe(
        Effect.andThen((result) =>
          result.error ? Effect.fail(result.error) : Effect.succeed(result),
        ),
        Effect.retry({
          times: 3,
          schedule: Schedule.exponential(this.retryBackoff),
          while: isRetryableSendError,
        }),
      );
      await Effect.runPromise(sendEmail).catch(console.error);
    }

    console.log(
      `Sent maintenance notification email to ${req.subscribers.length} subscribers`,
    );
  }

  public async sendPrivateLocationAlert(
    req: Omit<PrivateLocationAlertProps, "lastSeenAt"> & {
      to: string[];
      lastSeenAt: Date;
    },
  ) {
    if (req.to.length === 0) return;

    const subject =
      req.status === "error"
        ? `Your private location "${req.locationName}" is unhealthy`
        : `Your private location "${req.locationName}" is healthy again`;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Sending private location ${req.status} email to ${req.to.join(", ")}`,
      );
      return;
    }

    try {
      const html = await render(
        <PrivateLocationAlertEmail
          locationName={req.locationName}
          status={req.status}
          lastSeenAt={req.lastSeenAt.toISOString()}
        />,
      );
      const result = await this.client.batch.send(
        req.to.map((to) => ({
          from: "OpenStatus <notifications@notifications.openstatus.dev>",
          subject,
          to,
          html,
        })),
      );

      if (result.error) {
        if (result.error?.name === "rate_limit_exceeded") {
          throw result.error;
        }
        console.error(
          `Error sending private location alert to ${req.to}: ${result.error}`,
        );
        return;
      }

      console.log(`Sent private location ${req.status} email to ${req.to}`);
    } catch (err) {
      console.error(
        `Error sending private location alert to ${req.to}: ${err}`,
      );
    }
  }
}
