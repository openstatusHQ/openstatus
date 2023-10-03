import { db, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

/**
 * TODO: move the plan limit into the Unkey `{ meta }` to avoid an additional db call.
 * When an API Key is created, we need to include the `{ meta: { plan: "free" } }` to the key.
 * Then, we can just read the plan from the key and use it in the middleware.
 * Don't forget to update the key whenever a user changes their plan. (via `stripeRoute` webhook)
 *
 * That remindes me we need to downgrade the frequency/periodicity of monitors to 10m if the user downgrades their plan.
 */

export async function getWorkspace(id: number) {
  const _workspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, id))
    .get();

  return selectWorkspaceSchema.parse(_workspace);
}

export async function getLimitByWorkspaceId(id: number) {
  const { plan } = await getWorkspace(id);
  return allPlans[plan];
}
