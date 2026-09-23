import type { DB, ServiceContext } from "@openstatus/services";
import { hasPendingInvitation } from "@openstatus/services/invitation";
import {
  downgradeWorkspaceToFree,
  findTrialEligibleWorkspace,
  listOwnedTrialWorkspaces,
  updateWorkspacePlan,
  updateWorkspaceStripeId,
} from "@openstatus/services/workspace";
import MailChecker from "mailchecker";

import { env } from "../../env";
import {
  buildFromSubscriptionOrThrow,
  cancelSubscription,
  stripe,
} from "./shared";
import { getPriceIdForPlan } from "./utils";

export const TRIAL_DAYS = 14;

export type TrialSkipReason =
  | "disabled"
  | "sso"
  | "invited"
  | "disposable"
  | "already_trialed"
  | "not_eligible"
  | "stripe_error";

export type SignupTrialResult =
  | { started: true; trialEndsAt: Date }
  | { started: false; reason: TrialSkipReason };

function escapeSearchValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

async function hasTrialedBefore(email: string) {
  const result = await stripe.customers.search({
    query: `email:'${escapeSearchValue(email)}' AND metadata['trialed']:'true'`,
    limit: 1,
  });
  return result.data.length > 0;
}

async function resolveCurrency(priceId: string, requested: "USD" | "EUR") {
  const price = await stripe.prices.retrieve(priceId, {
    expand: ["currency_options"],
  });
  const wanted = requested.toLowerCase();
  return wanted === price.currency || price.currency_options?.[wanted]
    ? wanted
    : price.currency;
}

export async function maybeStartSignupTrial(args: {
  userId: number;
  email: string;
  provider?: string;
  currency: "USD" | "EUR";
  db?: DB;
}): Promise<SignupTrialResult> {
  const { db } = args;
  const email = args.email.trim().toLowerCase();

  if (
    env.SELF_HOST ||
    env.NODE_ENV === "development" ||
    !env.STRIPE_SECRET_KEY
  ) {
    return { started: false, reason: "disabled" };
  }
  if (args.provider === "workos") return { started: false, reason: "sso" };
  if (await hasPendingInvitation({ email, db })) {
    return { started: false, reason: "invited" };
  }
  if (!MailChecker.isValid(email)) {
    return { started: false, reason: "disposable" };
  }
  if (await hasTrialedBefore(email)) {
    return { started: false, reason: "already_trialed" };
  }

  const ws = await findTrialEligibleWorkspace({
    input: { userId: args.userId },
    db,
  });
  if (!ws) return { started: false, reason: "not_eligible" };

  const ctx: ServiceContext = {
    workspace: ws,
    actor: { type: "system", job: "signup-trial" },
    db,
  };

  const priceId = getPriceIdForPlan("starter", "monthly");
  if (!priceId) throw new Error("Missing Starter monthly price");
  const currency = await resolveCurrency(priceId, args.currency);

  const customer = await stripe.customers.create(
    { email, metadata: { workspaceId: String(ws.id), trialed: "true" } },
    { idempotencyKey: `trial-customer:ws_${ws.id}` },
  );

  await updateWorkspaceStripeId({ ctx, input: { stripeId: customer.id } });

  const subscription = await stripe.subscriptions.create(
    {
      customer: customer.id,
      currency,
      items: [{ price: priceId }],
      trial_period_days: TRIAL_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata: { source: "signup_trial", workspaceId: String(ws.id) },
    },
    { idempotencyKey: `trial-sub:ws_${ws.id}` },
  );

  const built = buildFromSubscriptionOrThrow(subscription);
  if (!built || !subscription.trial_end) {
    throw new Error(`Trial subscription ${subscription.id} is not a trial`);
  }

  const trialEndsAt = new Date(subscription.trial_end * 1000);

  await updateWorkspacePlan({
    ctx,
    input: {
      plan: built.plan,
      subscriptionId: subscription.id,
      endsAt: trialEndsAt,
      paidUntil: trialEndsAt,
      trialEndsAt,
      limits: built.limits,
      reason: "trial_started",
    },
  });

  return { started: true, trialEndsAt };
}

export async function cancelOwnedTrials(args: {
  userId: number;
  db?: DB;
}): Promise<string[]> {
  const { db } = args;
  const trials = await listOwnedTrialWorkspaces({
    input: { userId: args.userId },
    db,
  });

  const customDomains: string[] = [];
  for (const ws of trials) {
    await cancelSubscription(ws.stripeId ?? undefined);
    const result = await downgradeWorkspaceToFree({
      ctx: { workspace: ws, actor: { type: "user", userId: args.userId }, db },
      input: { reason: "account_deleted" },
    });
    customDomains.push(...result.customDomains);
  }

  return customDomains;
}
