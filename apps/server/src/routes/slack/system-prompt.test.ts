import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  test("includes the current date and time in ISO 8601 format", () => {
    const before = new Date();
    const prompt = buildSystemPrompt("My Workspace");
    const after = new Date();

    const match = prompt.match(
      /The current date and time is: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z) \(UTC\)/,
    );
    expect(match).not.toBeNull();

    // oxlint-disable-next-line typescript/no-non-null-assertion
    const promptDate = new Date(match![1]);
    expect(promptDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(promptDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("includes the workspace name", () => {
    const prompt = buildSystemPrompt("Acme Corp");
    expect(prompt).toContain('workspace "Acme Corp"');
  });

  test("tells the model a write call drafts a card instead of executing", () => {
    const prompt = buildSystemPrompt("Acme Corp");
    expect(prompt).toContain("does NOT execute");
    expect(prompt).toContain("Approve/Cancel");
    // The two ways the model strands the user without a card.
    expect(prompt).toContain("NEVER write the draft out as message text");
    expect(prompt).toContain("shall I go ahead?");
    // notify is a button, so the model must not spend a turn asking.
    expect(prompt).toContain("NEVER ask whether to notify subscribers");
  });

  test("guides the model on componentImpacts", () => {
    const prompt = buildSystemPrompt("Acme Corp");
    expect(prompt).toContain("componentImpacts");
    expect(prompt).toContain("major_outage");
    // resolve auto-clears impacts; the model must not publish a manual clear.
    expect(prompt).toContain("clears every remaining impact");
    // partial recovery before resolve IS reported manually, as operational.
    expect(prompt).toContain("Recovery counts as a change");
  });
});
