import { getChannel } from "@openstatus/subscriptions";

import { InternalServiceError } from "../errors";
import type { UpsertSelfSignupResult } from "./upsert";

type VerifiableSubscriber = Pick<
  UpsertSelfSignupResult,
  | "id"
  | "pageId"
  | "pageName"
  | "pageSlug"
  | "customDomain"
  | "email"
  | "token"
  | "acceptedAt"
>;

function subscriberVerifyUrl(
  subscriber: Pick<VerifiableSubscriber, "pageSlug" | "customDomain">,
  token: string,
) {
  const host =
    subscriber.customDomain || `${subscriber.pageSlug}.openstatus.dev`;
  return `https://${host}/verify/${token}`;
}

/**
 * Emails the double opt-in link to the subscriber's own address; the token
 * is never returned to the caller. No-op for a verified or tokenless row.
 */
export async function sendSubscriberVerification(args: {
  subscriber: VerifiableSubscriber;
}): Promise<void> {
  const { subscriber } = args;
  if (!subscriber.email || !subscriber.token || subscriber.acceptedAt) return;

  const channel = getChannel("email");
  if (!channel?.sendVerification) {
    throw new InternalServiceError("Email channel not found");
  }

  await channel.sendVerification(
    {
      id: subscriber.id,
      pageId: subscriber.pageId,
      pageName: subscriber.pageName,
      pageSlug: subscriber.pageSlug,
      customDomain: subscriber.customDomain,
      componentIds: [],
      channelType: "email",
      email: subscriber.email,
      token: subscriber.token,
    },
    subscriberVerifyUrl(subscriber, subscriber.token),
  );
}
