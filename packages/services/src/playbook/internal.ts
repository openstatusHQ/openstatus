import { and, eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import {
  playbookDefaultDescription,
  playbookDefaultTitle,
} from "@openstatus/db/src/schema/playbooks/constants";

import type { DB } from "../context";

export type PlaybookWithDefaults = Omit<Playbook, "title" | "description"> & {
  title: string;
  description: string;
};

/** Fills an unset title or description with the slug's default. */
export function withDefaults(row: Playbook): PlaybookWithDefaults {
  return {
    ...row,
    title: row.title ?? playbookDefaultTitle(row.slug),
    description: row.description ?? playbookDefaultDescription(row.slug),
  };
}

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
