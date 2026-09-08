import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

import { env } from "../../env";
import { buildLimitsFromSubscription } from "./utils";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2023-08-16",
  appInfo: {
    name: "OpenStatus",
    version: "0.1.0",
  },
});

// An unsupported price is a permanent misconfiguration; surface it as a 400 so
// Stripe stops retrying instead of hammering the endpoint on a 5xx.
export function buildFromSubscriptionOrThrow(
  subscription: Stripe.Subscription,
) {
  try {
    return buildLimitsFromSubscription(subscription);
  } catch (e) {
    console.error(e);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "Invalid subscription",
    });
  }
}

/**
 * The customer's live subscriptions and the one the workspace should follow:
 * the newest active subscription. Stripe returns `list` newest-first today but
 * does not contract it, so the pick is explicit.
 *
 * Always read through this rather than off a webhook payload: Stripe
 * guarantees neither delivery order nor exactly-once delivery, and it
 * serialises the payload with the API version pinned on the *endpoint* rather
 * than the one this client pins.
 */
export async function getCurrentSubscription(customerId: string) {
  const active = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  const current = active.data.reduce<Stripe.Subscription | undefined>(
    (newest, sub) =>
      newest === undefined || sub.created > newest.created ? sub : newest,
    undefined,
  );

  return { active: active.data, current };
}

/**
 * A customer carries exactly one subscription. `current` is the one to keep;
 * every subscription that predates it is a leftover that would otherwise keep
 * billing. Best-effort — a Stripe failure here must not fail the caller, which
 * for a webhook would mean Stripe replaying the whole plan sync.
 */
export async function cancelSupersededSubscriptions(
  subscriptions: Stripe.Subscription[],
  current: Stripe.Subscription,
) {
  // Never retire anything in favour of a subscription that is not itself
  // active. A checkout still settling (`incomplete` — async payment method,
  // deferred 3DS) would otherwise leave the customer with nothing active, and
  // the `customer.subscription.deleted` fired by our own cancellation reads
  // that as "they cancelled": `downgradeWorkspaceToFree` then hard-deletes
  // pages, deactivates monitors and strips members on the way to free.
  if (current.status !== "active") return;

  for (const sub of subscriptions) {
    if (sub.id === current.id) continue;
    // Only ever cancel *downwards*. A replayed or out-of-order delivery names
    // a subscription that may already have been superseded, and retiring the
    // newer one on its behalf is the failure this whole path exists to avoid.
    if (sub.created > current.created) continue;
    try {
      await stripe.subscriptions.cancel(sub.id);
    } catch (e) {
      console.error(`Failed to cancel superseded subscription ${sub.id}:`, e);
    }
  }
}

// Statuses that mean the customer still has a subscription. `incomplete` and
// `incomplete_expired` are abandoned checkouts, `unpaid` and `paused` no longer
// entitle anything, and `canceled` is gone.
const LIVE_STATUSES: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
];

/**
 * Every subscription that still entitles the customer to something. This is
 * the "is there anything left?" guard to use before a downgrade: filtering on
 * `active` alone misses a trialing or past-due subscription and drops the
 * workspace to free while the customer is still subscribed.
 */
export async function listLiveSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
  });

  return subscriptions.data.filter((sub) => LIVE_STATUSES.includes(sub.status));
}

export async function cancelSubscription(customer?: string) {
  if (!customer) return;

  try {
    const subscriptionId = await stripe.subscriptions
      .list({
        customer,
      })
      .then((res) => res.data[0]?.id);

    if (!subscriptionId) return;

    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: {
        comment: "Customer deleted their OpenStatus project.",
      },
    });
  } catch (error) {
    console.log("Error cancelling Stripe subscription", error);
    return;
  }
}
