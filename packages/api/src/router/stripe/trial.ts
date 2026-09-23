import { and, db as defaultDb, eq, isNotNull } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import type { DB } from "@openstatus/services";
import { hasPendingInvitation } from "@openstatus/services/invitation";
import {
  downgradeWorkspaceToFree,
  updateWorkspacePlan,
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
  const db = args.db ?? defaultDb;
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

  const row = await db
    .select({ workspace })
    .from(usersToWorkspaces)
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(
      and(
        eq(usersToWorkspaces.userId, args.userId),
        eq(usersToWorkspaces.role, "owner"),
      ),
    )
    .get();

  if (
    !row ||
    row.workspace.stripeId ||
    row.workspace.subscriptionId ||
    (row.workspace.plan && row.workspace.plan !== "free")
  ) {
    return { started: false, reason: "not_eligible" };
  }

  const ws = selectWorkspaceSchema.parse(row.workspace);

  const priceId = getPriceIdForPlan("starter", "monthly");
  if (!priceId) throw new Error("Missing Starter monthly price");
  const currency = await resolveCurrency(priceId, args.currency);

  const customer = await stripe.customers.create(
    { email, metadata: { workspaceId: String(ws.id), trialed: "true" } },
    { idempotencyKey: `trial-customer:ws_${ws.id}` },
  );

  await db
    .update(workspace)
    .set({ stripeId: customer.id })
    .where(eq(workspace.id, ws.id))
    .run();

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
    ctx: {
      workspace: { ...ws, stripeId: customer.id },
      actor: { type: "system", job: "signup-trial" },
      db,
    },
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
  const db = args.db ?? defaultDb;

  const rows = await db
    .select({ workspace })
    .from(usersToWorkspaces)
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(
      and(
        eq(usersToWorkspaces.userId, args.userId),
        eq(usersToWorkspaces.role, "owner"),
        isNotNull(workspace.trialEndsAt),
      ),
    )
    .all();

  const customDomains: string[] = [];
  for (const row of rows) {
    await cancelSubscription(row.workspace.stripeId ?? undefined);
    const result = await downgradeWorkspaceToFree({
      ctx: {
        workspace: selectWorkspaceSchema.parse(row.workspace),
        actor: { type: "user", userId: args.userId },
        db,
      },
    });
    customDomains.push(...result.customDomains);
  }

  return customDomains;
}
