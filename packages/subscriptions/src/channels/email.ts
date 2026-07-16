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

// Stable per status-report update / maintenance so Resend dedupes the email
// retry path. Status reports key off the specific update; maintenance has no
// update row, so fall back to its id + status.
function idempotencyKeyFor(pageUpdate: PageUpdate): string {
  return pageUpdate.updateId != null
    ? `status-report-update:${pageUpdate.updateId}`
    : `page-update:${pageUpdate.id}:${pageUpdate.status}`;
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
      pageUpdate.pageComponents,
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
    date: pageUpdate.date,
    pageComponents: pageUpdate.pageComponents,
    idempotencyKey: `${idempotencyKeyFor(pageUpdate)}:${payloadHash}`,
  });
}
