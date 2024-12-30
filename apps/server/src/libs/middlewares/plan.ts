import type { Variables } from "@/types";
import {
  type Workspace,
  workspacePlanHierarchy,
} from "@openstatus/db/src/schema";
import type { Context, Next } from "hono";
import { OpenStatusApiError } from "../errors";

/**
 * Checks if the workspace has a minimum required plan to access the endpoint
 */
export function minPlanMiddleware({ plan }: { plan: Workspace["plan"] }) {
  return async (c: Context<{ Variables: Variables }, "/*">, next: Next) => {
    const workspace = c.get("workspace");

    if (workspacePlanHierarchy[workspace.plan] < workspacePlanHierarchy[plan]) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "You need to upgrade your plan to access this feature",
      });
    }

    await next();
  };
}
