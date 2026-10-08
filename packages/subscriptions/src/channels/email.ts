import { EmailClient } from "@openstatus/emails";
import { z } from "zod";

import type { PageUpdate, Subscription } from "../types";

let emailClient: EmailClient | null = null;

function getEmailClient(): EmailClient {
  if (!emailClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY environment variable is required for email notifications",
      );
    }
    emailClient = new EmailClient({
      apiKey: process.env.RESEND_API_KEY,
    });
  }
  return emailClient;
}

export async function validateEmailConfig(config: unknown) {
  const email = z.email().safeParse(config);
  return { valid: email.success, error: email.error?.message };
}

// Stable per entity update so Resend dedupes the email retry path.
function idempotencyKeyFor(pageUpdate: PageUpdate): string {
  if (pageUpdate.updateId == null) {
    return `page-update:${pageUpdate.id}:${pageUpdate.status}`;
  }
  return pageUpdate.status === "maintenance"
    ? `maintenance-update:${pageUpdate.updateId}`
    : `status-report-update:${pageUpdate.updateId}`;
}

// FNV-1a, Edge-safe (no node:crypto). Resend 409s when a key is reused within
// 24h with a different body (e.g. the subscriber list changed between two
// dispatches of the same update), so the key must vary with the payload while
// staying identical across retries of the same send.
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function hasEmailAndToken(
  sub: Subscription,
): sub is Subscription & { email: string; token: string } {
  return (
    sub.email !== undefined &&
    sub.email !== null &&
    sub.token !== undefined &&
    sub.token !== null
  );
}

export async function sendEmailVerification(
  subscription: Subscription,
  verifyUrl: string,
) {
  if (!subscription.email) {
    throw new Error("Email is required for email channel");
  }

  const client = getEmailClient();
  await client.sendPageSubscription({
    to: subscription.email,
    link: verifyUrl,
    page: subscription.pageName,
  });
}

export async function sendEmailNotifications(
  subscriptions: Subscription[],
  pageUpdate: PageUpdate,
) {
  if (subscriptions.length === 0) return;

  const validSubscriptions = subscriptions.filter(hasEmailAndToken);
  if (validSubscriptions.length === 0) return;

  const firstSub = validSubscriptions[0];

  const payloadHash = fingerprint(
    JSON.stringify([
      validSubscriptions.map((sub) => [sub.email, sub.token]),
      firstSub.pageName,
      firstSub.pageSlug,
      firstSub.customDomain ?? null,
      pageUpdate.title,
      pageUpdate.status,
      pageUpdate.message,
      pageUpdate.date,
      // the maintenance window is rendered instead of `date` below
      pageUpdate.startsAt ?? null,
      pageUpdate.endsAt ?? null,
      pageUpdate.pageComponents,
      pageUpdate.componentsWithImpact?.map((c) => c.impact),
    ]),
  );

  const client = getEmailClient();
  await client.sendStatusReportUpdate({
    subscribers: validSubscriptions.map((sub) => ({
      email: sub.email,
      token: sub.token,
    })),
    pageTitle: firstSub.pageName,
    pageSlug: firstSub.pageSlug,
    customDomain: firstSub.customDomain,
    reportTitle: pageUpdate.title,
    status: pageUpdate.status,
    message: pageUpdate.message,
    // the template prints non-date strings verbatim, so the window reads "from - to"
    date:
      pageUpdate.status === "maintenance" &&
      pageUpdate.startsAt &&
      pageUpdate.endsAt
        ? `${pageUpdate.startsAt} - ${pageUpdate.endsAt}`
        : pageUpdate.date,
    pageComponents: pageUpdate.pageComponents,
    componentImpacts: pageUpdate.componentsWithImpact,
    idempotencyKey: `${idempotencyKeyFor(pageUpdate)}:${payloadHash}`,
  });
}
