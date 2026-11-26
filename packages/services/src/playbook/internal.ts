import { and, eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import type { PlaybookType } from "@openstatus/db/src/schema/playbooks/constants";

import type { DB } from "../context";

export async function getPlaybookOfType(
  tx: DB,
  workspaceId: number,
  type: PlaybookType,
): Promise<Playbook | undefined> {
  return tx
    .select()
    .from(playbook)
    .where(and(eq(playbook.workspaceId, workspaceId), eq(playbook.type, type)))
    .get();
}
