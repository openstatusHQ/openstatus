import { and, eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";

import type { DB } from "../context";

export async function getPlaybookBySlug(
  tx: DB,
  workspaceId: number,
  slug: string,
): Promise<Playbook | undefined> {
  return tx
    .select()
    .from(playbook)
    .where(and(eq(playbook.workspaceId, workspaceId), eq(playbook.slug, slug)))
    .get();
}
