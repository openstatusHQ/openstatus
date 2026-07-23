import { workspacePlanSchema } from "@openstatus/db/src/schema";
import { limitsSchema } from "@openstatus/db/src/schema/plan/schema";
import { z } from "zod";

export const GetWorkspaceInput = z.object({}).strict();
export type GetWorkspaceInput = z.infer<typeof GetWorkspaceInput>;

export const GetWorkspaceWithUsageInput = z.object({}).strict();
export type GetWorkspaceWithUsageInput = z.infer<
  typeof GetWorkspaceWithUsageInput
>;

export const ListWorkspacesInput = z.object({ userId: z.number().int() });
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesInput>;

export const GetWorkspaceByStripeIdInput = z.object({
  stripeId: z.string().min(1),
});
export type GetWorkspaceByStripeIdInput = z.infer<
  typeof GetWorkspaceByStripeIdInput
>;

export const UpdateWorkspaceNameInput = z.object({
  name: z.string().min(1),
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
  limits: limitsSchema,
  reason: z.string().optional(),
});
export type UpdateWorkspacePlanInput = z.infer<typeof UpdateWorkspacePlanInput>;
