import type { SubscriptionChannel } from "@openstatus/subscriptions";
import { getChannel } from "@openstatus/subscriptions";

import type { DB } from "../context";
import { InternalServiceError, ValidationError } from "../errors";
import { hasPendingSubscriber } from "./has-pending";
import { UpsertSelfSignupSubscriberInput } from "./schemas";
import { upsertSelfSignupSubscriber } from "./upsert";

const PENDING_SUBSCRIPTION_MESSAGE =
  "A confirmation link was already sent. Please check your email or wait until it expires to request a new one.";

// Anonymous self-signup resolves workspace and audit actor in the upsert verb.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function subscribeSelfSignupSubscriber(args: {
  input: UpsertSelfSignupSubscriberInput;
  db?: DB;
  channel?: SubscriptionChannel;
}) {
  const input = UpsertSelfSignupSubscriberInput.parse(args.input);

  const isPending = await hasPendingSubscriber({
    input: { email: input.email, pageId: input.pageId },
    db: args.db,
  });
  if (isPending) {
    throw new ValidationError(PENDING_SUBSCRIPTION_MESSAGE);
  }

  const subscription = await upsertSelfSignupSubscriber({
    input,
    db: args.db,
  });

  if (subscription.acceptedAt) {
    throw new ValidationError("Email already subscribed");
  }
  if (!subscription.token) {
    throw new InternalServiceError("Subscription has no verification token");
  }

  const channel = args.channel ?? getChannel("email");
  if (!channel?.sendVerification) {
    throw new InternalServiceError("Email channel not found");
  }

  const verifyUrl = subscription.customDomain
    ? `https://${subscription.customDomain}/verify/${subscription.token}`
    : `https://${subscription.pageSlug}.openstatus.dev/verify/${subscription.token}`;

  await channel.sendVerification(
    {
      id: subscription.id,
      pageId: subscription.pageId,
      pageName: subscription.pageName,
      pageSlug: subscription.pageSlug,
      customDomain: subscription.customDomain,
      componentIds: subscription.componentIds,
      channelType: "email",
      email: subscription.email,
      token: subscription.token,
      acceptedAt: subscription.acceptedAt ?? undefined,
      unsubscribedAt: subscription.unsubscribedAt ?? undefined,
    },
    verifyUrl,
  );

  return { success: true };
}
