import type { DB, ServiceContext } from "@openstatus/services";
import { listUserProviders } from "@openstatus/services/user";
import {
  downgradeWorkspaceToFree,
  isTrialEligibleWorkspace,
  listOwnedTrialWorkspaces,
} from "@openstatus/services/workspace";
import MailChecker from "mailchecker";
import type Stripe from "stripe";

import { env } from "../../env";
import { cancelSubscription, stripe } from "./shared";

export const TRIAL_DAYS = 14;

// A magic link proves only inbox access and SSO members are provisioned by
// their org, so only these sign-ins can open a trial.
const TRIAL_PROVIDERS = ["github", "google"];

export type TrialSkipReason =
  | "disabled"
  | "sso"
  | "email"
  | "disposable"
  | "already_trialed"
  | "already_subscribed"
  | "not_eligible";

export type TrialEligibility =
  | { eligible: true }
  | { eligible: false; reason: TrialSkipReason };

export type TrialSurface = "billing" | "plan_table" | "upgrade_dialog";

// `customers.list` is read-after-write consistent; the Search API is not, so
// a re-signup right after a trial could slip past it. Its email filter is
// case-sensitive and customers keep the email as stored, so both spellings
// are checked.
async function hasTrialedBefore(email: string) {
  const emails = [...new Set([email, email.toLowerCase()])];
  const results = await Promise.all(
    emails.map((e) => stripe.customers.list({ email: e, limit: 100 })),
  );
  return results.some((r) => r.data.some((c) => c.metadata.trialed === "true"));
}

// `incomplete` is what an abandoned checkout leaves behind; it never entitled
// anything and must not burn the trial.
async function hasEverSubscribed(customerId: string) {
  const result = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return result.data.some(
    (sub) => sub.status !== "incomplete" && sub.status !== "incomplete_expired",
  );
}

/**
 * Cheapest first: the workspace row, then DB reads, then Stripe. `stripe:
 * false` skips the Stripe guards, which only catch trials from before
 * `trialedAt` and ex-subscribers; the Checkout mutation always runs them.
 */
export async function checkTrialEligibility(args: {
  ctx: ServiceContext;
  email: string | null;
  stripe?: boolean;
}): Promise<TrialEligibility> {
  const { ctx } = args;
  const email = args.email?.trim() ?? "";

  if (env.SELF_HOST || !env.STRIPE_SECRET_KEY) {
    return { eligible: false, reason: "disabled" };
  }

  const userId = "userId" in ctx.actor ? ctx.actor.userId : undefined;
  if (!userId) return { eligible: false, reason: "not_eligible" };

  const ws = ctx.workspace;
  if (ws.trialedAt) return { eligible: false, reason: "already_trialed" };
  // A fresh signup workspace has no plan column yet — that is free.
  if ((ws.plan && ws.plan !== "free") || ws.subscriptionId || ws.trialEndsAt) {
    return { eligible: false, reason: "not_eligible" };
  }

  const providers = await listUserProviders({ input: { userId }, db: ctx.db });
  if (!providers.some((p) => TRIAL_PROVIDERS.includes(p))) {
    const sso = providers.includes("workos") || providers.includes("oidc");
    return { eligible: false, reason: sso ? "sso" : "email" };
  }
  if (!email || !MailChecker.isValid(email.toLowerCase())) {
    return { eligible: false, reason: "disposable" };
  }
  if (!(await isTrialEligibleWorkspace({ ctx }))) {
    return { eligible: false, reason: "not_eligible" };
  }
  if (args.stripe === false) return { eligible: true };
  if (await hasTrialedBefore(email)) {
    return { eligible: false, reason: "already_trialed" };
  }
  if (
    ctx.workspace.stripeId &&
    (await hasEverSubscribed(ctx.workspace.stripeId))
  ) {
    return { eligible: false, reason: "already_subscribed" };
  }

  return { eligible: true };
}

export const TRIAL_SKIP_MESSAGE: Record<TrialSkipReason, string> = {
  disabled: "Trials are not available on this installation.",
  sso: "Trials are not available for SSO accounts.",
  email: "Sign in with GitHub or Google to start a trial.",
  disposable: "Trials are not available for this email address.",
  already_trialed: "This workspace or email has already used a trial.",
  already_subscribed: "This workspace has already had a subscription.",
  not_eligible: "Only the owner of a free workspace can start a trial.",
};

/** The Checkout fields that turn a Starter subscription into a card-less trial. */
export function trialCheckoutParams(args: {
  surface?: TrialSurface;
  intent?: string;
}): Pick<
  Stripe.Checkout.SessionCreateParams,
  "payment_method_collection" | "subscription_data"
> {
  return {
    payment_method_collection: "if_required",
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      metadata: {
        source: "trial_opt_in",
        ...(args.surface && { surface: args.surface }),
        ...(args.intent && { intent: args.intent }),
      },
    },
  };
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
