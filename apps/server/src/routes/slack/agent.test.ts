import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "./agent";

describe("buildSystemPrompt", () => {
  test("includes the current date and time in ISO 8601 format", () => {
    const before = new Date();
    const prompt = buildSystemPrompt("My Workspace");
    const after = new Date();

    const match = prompt.match(
      /The current date and time is: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z) \(UTC\)/,
    );
    expect(match).not.toBeNull();

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const promptDate = new Date(match![1]);
    expect(promptDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(promptDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("includes the workspace name", () => {
    const prompt = buildSystemPrompt("Acme Corp");
    expect(prompt).toContain('workspace "Acme Corp"');
  });
});
