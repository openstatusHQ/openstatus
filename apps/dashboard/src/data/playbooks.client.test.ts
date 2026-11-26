import {
  PLAYBOOK_MAX_CHARS,
  playbookSlugs,
} from "@openstatus/db/src/schema/playbooks/constants";
import { describe, expect, it } from "vitest";

import { playbookTemplate } from "./playbooks.client";

describe("playbookTemplate", () => {
  it.each(playbookSlugs)("%s fits the cap and needs no filling in", (slug) => {
    const template = playbookTemplate[slug];
    expect(template.trim()).toBe(template);
    expect(template.length).toBeLessThanOrEqual(PLAYBOOK_MAX_CHARS);
    // `- [ ]` checklists are fine; a `[bracketed]` blank is not
    expect(template.replaceAll("- [ ]", "")).not.toMatch(/\[[^\]]+\]/);
  });
});
