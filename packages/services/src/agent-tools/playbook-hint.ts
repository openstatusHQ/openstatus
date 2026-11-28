import type { BuiltinPlaybookSlug } from "@openstatus/db/src/schema/playbooks/constants";

/** Sentence appended to the description of tools whose text a playbook governs. */
export function playbookHint(slug: BuiltinPlaybookSlug): string {
  return ` If the team has written a \`${slug}\` playbook, read it with get_playbook before writing the text and follow it.`;
}
