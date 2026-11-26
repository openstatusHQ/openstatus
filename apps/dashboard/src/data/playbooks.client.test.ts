import {
  PLAYBOOK_MAX_CHARS,
  playbookType,
} from "@openstatus/db/src/schema/playbooks/constants";
import { describe, expect, it } from "vitest";

import {
  playbookSlug,
  playbookTemplate,
  playbookTypeFromSlug,
} from "./playbooks.client";

describe("playbookTemplate", () => {
  it.each(playbookType)("%s fits the cap and needs no filling in", (type) => {
    const template = playbookTemplate[type];
    expect(template.trim()).toBe(template);
    expect(template.length).toBeLessThanOrEqual(PLAYBOOK_MAX_CHARS);
    // `- [ ]` checklists are fine; a `[bracketed]` blank is not
    expect(template.replaceAll("- [ ]", "")).not.toMatch(/\[[^\]]+\]/);
  });
});

describe("playbookSlug", () => {
  it.each(playbookType)("%s round-trips", (type) => {
    expect(playbookTypeFromSlug(playbookSlug(type))).toBe(type);
  });
});
