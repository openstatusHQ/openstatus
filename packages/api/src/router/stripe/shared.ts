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

// Statuses that mean the customer still has a subscription. `incomplete` and
// `incomplete_expired` are abandoned checkouts, `unpaid` and `paused` no longer
// entitle anything, and `canceled` is gone.
const LIVE_STATUSES: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
];

/**
 * Every subscription that still entitles the customer to something.
 *
 * Auto-paged on purpose: every abandoned checkout leaves an `incomplete` (then
 * `incomplete_expired`) subscription behind and Stripe returns those in an
 * unfiltered list, so enough of them push a customer's real subscription past
 * the first page. Reading one page would report "nothing left" for a paying
 * customer — which is what `customer.subscription.deleted` turns into a
 * destructive downgrade.
 */
export async function listLiveSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions
    .list({ customer: customerId, limit: 100 })
    .autoPagingToArray({ limit: 1000 });

  return subscriptions.filter((sub) => LIVE_STATUSES.includes(sub.status));
}

/**
 * Total order over a customer's subscriptions, newest first. `created` is only
 * second-granular, so two subscriptions can tie; falling back to the id keeps
 * every caller — the "which one is current" pick, the staleness guard and the
 * cancellation — resolving a tie the same way instead of each choosing its own
 * winner and contradicting the others.
 */
export function isNewerSubscription(
  a: Stripe.Subscription,
  b: Stripe.Subscription,
) {
  if (a.created !== b.created) return a.created > b.created;
  return a.id > b.id;
}

/**
 * The customer's live subscriptions and the one the workspace should follow:
 * the newest of them. Stripe returns `list` newest-first today but does not
 * contract it, so the pick is explicit.
 *
 * Live rather than strictly `active`: a newer subscription that is `trialing`
 * or `past_due` still entitles the customer, and omitting it would let an
 * older active one look current and revert the workspace onto its plan.
 *
 * Always read through this rather than off a webhook payload: Stripe
 * guarantees neither delivery order nor exactly-once delivery, and it
 * serialises the payload with the API version pinned on the *endpoint* rather
 * than the one this client pins.
 */
export async function getCurrentSubscription(customerId: string) {
  const live = await listLiveSubscriptions(customerId);

  const current = live.reduce<Stripe.Subscription | undefined>(
    (newest, sub) =>
      newest === undefined || isNewerSubscription(sub, newest) ? sub : newest,
    undefined,
  );

  return { live, current };
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
    if (isNewerSubscription(sub, current)) continue;
    try {
      await stripe.subscriptions.cancel(sub.id);
    } catch (e) {
      console.error(`Failed to cancel superseded subscription ${sub.id}:`, e);
    }
  }
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
