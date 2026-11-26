import type { PlaybookSlug } from "@openstatus/db/src/schema/playbooks/constants";

/** Sentence appended to the description of tools whose text a playbook governs. */
export function playbookHint(...slugs: PlaybookSlug[]): string {
  const names = slugs.map((s) => `\`${s}\``).join(" and ");
  const noun = slugs.length === 1 ? "playbook" : "playbooks";
  return ` If the team has written a ${names} ${noun} (list_playbooks), read it with get_playbook before writing the text and follow it.`;
}
