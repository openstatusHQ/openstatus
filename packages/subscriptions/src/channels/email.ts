import { EmailClient } from "@openstatus/emails";
import { z } from "zod";
import type { PageUpdate, Subscription } from "../types";

/**
 * Email channel implementation
 * Uses EmailClient for batched sending (chunks of 100, with retry logic)
 */

// Lazy initialization of email client to avoid crashing in dev/test environments
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

/**
 * Type guard to filter subscriptions with email
 */
function hasEmail(sub: Subscription): sub is Subscription & { email: string } {
  return sub.email !== undefined && sub.email !== null;
}

/**
 * Send verification email to new subscriber
 * Potentially, we can put a redirect to the /manage/token in the UI part
 * after user accepted -> directly sees the management page
 */
export async function sendEmailVerification(
  subscription: Subscription,
  verifyUrl: string,
) {
  if (!subscription.email) {
    throw new Error("Email is required for email channel");
  }

  const client = getEmailClient();
  await client.sendPageSubscriptionVerification({
    to: subscription.email,
    link: verifyUrl,
    page: subscription.pageName,
  });
}

/**
 * Send notifications to multiple subscribers in batches.
 * Uses EmailClient.sendStatusReportUpdate which:
 * - Chunks subscribers into batches of 100
 * - Uses Resend batch.send API for efficiency
 * - Includes personalized unsubscribe URLs per subscriber
 * - Retries with exponential backoff
 */
export async function sendEmailNotifications(
  subscriptions: Subscription[],
  pageUpdate: PageUpdate,
) {
  if (subscriptions.length === 0) return;

  // Validate all subscriptions have email
  const validSubscriptions = subscriptions.filter(hasEmail);
  if (validSubscriptions.length === 0) return;

  // Get page info from first subscription (all subscriptions are for same page)
  const firstSub = validSubscriptions[0];

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
  });
}
