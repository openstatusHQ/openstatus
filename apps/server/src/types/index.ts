import type { Workspace } from "@openstatus/db/src/schema";
import type { RequestIdVariables } from "hono/request-id";

export type Variables = RequestIdVariables & {
  workspace: Workspace;
};
