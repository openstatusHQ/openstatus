import { and, eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import { PLAYBOOK_MAX_CHARS } from "@openstatus/db/src/schema/playbooks/constants";
import {
  type PlaybookVariables,
  playbookVariableNames,
  playbookVariableValue,
  renderPlaybook,
} from "@openstatus/db/src/schema/playbooks/variables";

import { type DB, type ServiceContext, tryGetActorUserId } from "../context";
import { ConflictError, ValidationError } from "../errors";

export async function getPlaybookBySlug(
  db: DB,
  workspaceId: number,
  slug: string,
): Promise<Playbook | undefined> {
  return db
    .select()
    .from(playbook)
    .where(and(eq(playbook.workspaceId, workspaceId), eq(playbook.slug, slug)))
    .get();
}

/** Keeps the non-empty values of variables the text uses, in order of use; throws when the filled-in text is too long. */
export function storedVariables(
  content: string,
  variables: PlaybookVariables | undefined,
): PlaybookVariables | null {
  const entries = playbookVariableNames(content).flatMap((name) => {
    const value = playbookVariableValue(variables, name);
    return value ? [[name, value] as const] : [];
  });
  const stored = entries.length ? Object.fromEntries(entries) : null;
  if (renderPlaybook(content, stored).length > PLAYBOOK_MAX_CHARS) {
    throw new ValidationError(
      `A playbook is limited to ${PLAYBOOK_MAX_CHARS} characters with its variables filled in.`,
    );
  }
  return stored;
}

/** The caller audits the returned row as `playbook.create`. */
export async function insertPlaybook(
  tx: DB,
  ctx: ServiceContext,
  values: Pick<
    Playbook,
    "slug" | "title" | "description" | "content" | "variables"
  >,
): Promise<Playbook> {
  const actorUserId = tryGetActorUserId(ctx.actor);
  // a concurrent first write of the slug loses on the unique index
  const created = await tx
    .insert(playbook)
    .values({
      ...values,
      workspaceId: ctx.workspace.id,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .onConflictDoNothing()
    .returning()
    .get();
  if (!created) {
    throw new ConflictError(`A ${values.slug} playbook already exists.`);
  }
  return created;
}
