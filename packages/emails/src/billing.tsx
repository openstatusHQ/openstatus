/** @jsxRuntime automatic @jsxImportSource react */

import { render } from "react-email";

import { plural } from "../emails/_components/format";
import type { PlanLoss } from "../emails/_components/plan-loss";
import CancellationScheduledEmail, {
  CANCELLATION_SCHEDULED_SUBJECT,
} from "../emails/cancellation-scheduled";
import MemberRemovedEmail, {
  type MemberRemovedProps,
  memberRemovedSubject,
} from "../emails/member-removed";
import PlanDowngradedEmail, {
  type PlanDowngradedProps,
  planDowngradedSubject,
} from "../emails/plan-downgraded";
import PlanEndingSoonEmail, {
  type PlanEndingSoonProps,
  planEndingSoonSubject,
} from "../emails/plan-ending-soon";
import TrialEndingEmail from "../emails/trial-ending";
import { TRIAL_ENDING_SUBJECT } from "../emails/trial-ending";
import { sendBatchEmailHtml, sendEmail } from "./send";

const RAW_FROM = "Thibault from openstatus <thibault@openstatus.dev>";
// Signed hybrid: personal name on the system subdomain, replies to a real inbox.
const SIGNED_FROM =
  "Thibault from openstatus <thibault@notifications.openstatus.dev>";
const SIGNED_REPLY_TO = "thibault@openstatus.dev";
const SYSTEM_FROM = "openstatus <notifications@notifications.openstatus.dev>";
const SUPPORT_EMAIL = "ping@openstatus.dev";

const DAY_MS = 86_400_000;
export const REMINDER_LEAD_DAYS = 3;
const RESEND_MAX_SCHEDULE_DAYS = 30;
const RESEND_BATCH_SIZE = 100;

/** `stripe:<event.id>:<template>` — a Stripe redelivery reuses the event id. */
export function stripeIdempotencyKey(eventId: string, template: string) {
  return `stripe:${eventId}:${template}`;
}

/** Workspace owners + Stripe customer email, deduped case-insensitively. */
export function billingRecipients(
  owners: Array<string | null | undefined>,
  customerEmail?: string | null,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...owners, customerEmail]) {
    const email = raw?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
}

/** Plain-text loss lines for the raw cancellation email. */
export function planLossLines(loss: PlanLoss): string[] {
  const lines: string[] = [];
  if (loss.pagesDeleted.length > 0) {
    const n = loss.pagesDeleted.length;
    lines.push(
      `${plural(n, "status page")} ${n === 1 ? "gets" : "get"} deleted (${loss.pagesDeleted.join(", ")})`,
    );
  }
  if (loss.monitorsDeactivated > 0) {
    const n = loss.monitorsDeactivated;
    lines.push(`${plural(n, "monitor")} ${n === 1 ? "gets" : "get"} paused`);
  }
  if (loss.membersRemoved > 0) {
    const n = loss.membersRemoved;
    lines.push(`${plural(n, "member")} ${n === 1 ? "loses" : "lose"} access`);
  }
  if (loss.invitationsDeleted > 0) {
    const n = loss.invitationsDeleted;
    lines.push(
      `${plural(n, "pending invitation")} ${n === 1 ? "gets" : "get"} deleted`,
    );
  }
  if (loss.notificationsDeleted > 0) {
    const n = loss.notificationsDeleted;
    lines.push(
      `${plural(n, "notification channel")} ${n === 1 ? "gets" : "get"} removed`,
    );
  }
  if (loss.customDomains.length > 0) {
    const many = loss.customDomains.length > 1;
    lines.push(
      `the custom domain${many ? "s" : ""} ${loss.customDomains.join(", ")} ${
        many ? "are" : "is"
      } released`,
    );
  }
  if (loss.sso) lines.push("SAML SSO turns off");
  return lines;
}

/**
 * When to send the "plan ends in 3 days" reminder, or null when it cannot be
 * scheduled: already inside the lead window, or beyond Resend's 30-day limit.
 */
export function reminderScheduledAt(endsAt: Date, now = new Date()) {
  const at = new Date(endsAt.getTime() - REMINDER_LEAD_DAYS * DAY_MS);
  if (at.getTime() <= now.getTime()) return null;
  if (at.getTime() - now.getTime() > RESEND_MAX_SCHEDULE_DAYS * DAY_MS) {
    return null;
  }
  return at;
}

export async function sendPlanDowngraded(
  req: PlanDowngradedProps & { to: string[]; eventId: string },
) {
  if (req.to.length === 0) return;
  const { to, eventId, ...props } = req;
  return sendEmail(
    {
      from: SIGNED_FROM,
      reply_to: SIGNED_REPLY_TO,
      to,
      subject: planDowngradedSubject(props),
      react: <PlanDowngradedEmail {...props} />,
    },
    { idempotencyKey: stripeIdempotencyKey(eventId, "plan-downgraded") },
  );
}

export async function sendMemberRemoved(
  req: MemberRemovedProps & { to: string[]; idempotencyKey?: string },
) {
  if (req.to.length === 0) return;
  const { to, idempotencyKey, ...props } = req;
  const html = await render(<MemberRemovedEmail {...props} />);
  // Resend's batch API takes at most 100 emails.
  for (let i = 0; i < to.length; i += RESEND_BATCH_SIZE) {
    await sendBatchEmailHtml(
      to.slice(i, i + RESEND_BATCH_SIZE).map((email) => ({
        from: SYSTEM_FROM,
        reply_to: SUPPORT_EMAIL,
        to: email,
        subject: memberRemovedSubject(props),
        html,
      })),
      {
        idempotencyKey: idempotencyKey
          ? `${idempotencyKey}:${i / RESEND_BATCH_SIZE}`
          : undefined,
      },
    );
  }
}

export async function sendCancellationScheduled(req: {
  to: string[];
  eventId: string;
  plan: string;
  endsAt: Date;
  loss: PlanLoss;
}) {
  if (req.to.length === 0) return;
  return sendEmail(
    {
      from: RAW_FROM,
      to: req.to,
      subject: CANCELLATION_SCHEDULED_SUBJECT,
      react: (
        <CancellationScheduledEmail
          plan={req.plan}
          endsAt={req.endsAt}
          losses={planLossLines(req.loss)}
        />
      ),
    },
    {
      idempotencyKey: stripeIdempotencyKey(
        req.eventId,
        "cancellation-scheduled",
      ),
    },
  );
}

/** Returns the Resend id to cancel on resume, or undefined if not scheduled. */
export async function schedulePlanEndingSoon(
  req: PlanEndingSoonProps & { to: string[]; eventId: string; now?: Date },
) {
  if (req.to.length === 0) return;
  const { to, eventId, now, ...props } = req;
  const scheduledAt = reminderScheduledAt(props.endsAt, now);
  if (!scheduledAt) return;
  return sendEmail(
    {
      from: SIGNED_FROM,
      reply_to: SIGNED_REPLY_TO,
      to,
      subject: planEndingSoonSubject(props),
      react: <PlanEndingSoonEmail {...props} />,
    },
    {
      idempotencyKey: stripeIdempotencyKey(eventId, "plan-ending-soon"),
      scheduledAt: scheduledAt.toISOString(),
    },
  );
}

export async function sendTrialEnding(req: {
  to: string[];
  eventId: string;
  trialEnd: Date;
}) {
  if (req.to.length === 0) return;
  return sendEmail(
    {
      from: RAW_FROM,
      to: req.to,
      subject: TRIAL_ENDING_SUBJECT,
      react: <TrialEndingEmail trialEnd={req.trialEnd} />,
    },
    { idempotencyKey: stripeIdempotencyKey(req.eventId, "trial-ending") },
  );
}
