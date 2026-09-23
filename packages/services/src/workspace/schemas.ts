import { workspacePlanSchema } from "@openstatus/db/src/schema";
import { limitsSchema } from "@openstatus/db/src/schema/plan/schema";
import { z } from "zod";

export const GetWorkspaceInput = z.object({}).strict();
export type GetWorkspaceInput = z.infer<typeof GetWorkspaceInput>;

export const GetWorkspaceUsageInput = z.object({}).strict();
export type GetWorkspaceUsageInput = z.infer<typeof GetWorkspaceUsageInput>;

export const ListWorkspacesInput = z.object({ userId: z.number().int() });
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesInput>;

export const GetWorkspaceByStripeIdInput = z.object({
  stripeId: z.string().min(1),
});
export type GetWorkspaceByStripeIdInput = z.infer<
  typeof GetWorkspaceByStripeIdInput
>;

export const GetWorkspaceForMemberInput = z.object({
  slug: z.string().min(1),
  userId: z.number().int(),
});
export type GetWorkspaceForMemberInput = z.infer<
  typeof GetWorkspaceForMemberInput
>;

export const ListWorkspaceOwnersInput = z.object({
  workspaceId: z.number().int(),
});
export type ListWorkspaceOwnersInput = z.infer<typeof ListWorkspaceOwnersInput>;

export const OwnedWorkspacesInput = z.object({ userId: z.number().int() });
export type OwnedWorkspacesInput = z.infer<typeof OwnedWorkspacesInput>;

export const UpdateWorkspaceStripeIdInput = z.object({
  stripeId: z.string().min(1),
});
export type UpdateWorkspaceStripeIdInput = z.infer<
  typeof UpdateWorkspaceStripeIdInput
>;

/**
 * Replace the workspace's feature limits without touching the plan — an
 * addon bought or removed. `trialEndsAt: null` records that buying the
 * addon ended the trial; `reason` lands in the audit metadata.
 */
export const UpdateWorkspaceLimitsInput = z.object({
  limits: limitsSchema,
  trialEndsAt: z.date().nullable().optional(),
  reason: z.string().optional(),
});
export type UpdateWorkspaceLimitsInput = z.infer<
  typeof UpdateWorkspaceLimitsInput
>;

/**
 * `reason` is stamped on the plan-flip audit row (and the SSO one) so a
 * trial that ran out reads differently from a paying customer churning.
 * Defaults to `subscription_deleted`.
 */
export const DowngradeWorkspaceInput = z.object({
  reason: z.string().optional(),
});
export type DowngradeWorkspaceInput = z.infer<typeof DowngradeWorkspaceInput>;

export const UpdateWorkspaceNameInput = z.object({
  name: z.string().trim().min(1),
});
export type UpdateWorkspaceNameInput = z.infer<typeof UpdateWorkspaceNameInput>;

/**
 * Set a workspace's billing plan and the columns that move with it
 * (subscription id, paid-until / ends-at dates, feature limits). Driven
 * by the Stripe webhook — `limits` is the structured object; the verb
 * serialises it to the `text` column. `reason` is stamped into the audit
 * row's `metadata` so a plan change from an involuntary cancellation is
 * distinguishable from a checkout upgrade.
 */
export const UpdateWorkspacePlanInput = z.object({
  plan: workspacePlanSchema,
  subscriptionId: z.string().nullable(),
  paidUntil: z.date().nullable(),
  endsAt: z.date().nullable(),
  trialEndsAt: z.date().nullable().optional(),
  limits: limitsSchema,
  reason: z.string().optional(),
});
export type UpdateWorkspacePlanInput = z.infer<typeof UpdateWorkspacePlanInput>;
