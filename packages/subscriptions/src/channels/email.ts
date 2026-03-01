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
