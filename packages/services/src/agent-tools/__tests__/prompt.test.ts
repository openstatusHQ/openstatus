import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  type AgentSystemPromptOptions,
  buildAgentSystemPrompt,
} from "../prompt";

const base: AgentSystemPromptOptions = {
  workspaceName: "Acme",
  surface: "dashboard",
  canNotifySubscribers: true,
};

describe("buildAgentSystemPrompt", () => {
  test("interpolates the workspace name and leaves no template gaps", () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      workspaceName: "Acme Inc",
    });
    expect(prompt).toContain('workspace "Acme Inc"');
    expect(prompt).not.toContain("${");
  });

  test("uses the injected clock for the date anchor", () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      now: new Date("2026-01-02T03:04:05.000Z"),
    });
    expect(prompt).toContain("2026-01-02T03:04:05.000Z");
  });

  test("slack surface skips the dashboard-only post-tool rule", () => {
    const prompt = buildAgentSystemPrompt({ ...base, surface: "slack" });
    expect(prompt).toContain("running inside Slack");
    expect(prompt).not.toContain("running inside the openstatus dashboard");
    expect(prompt).not.toContain("already renders a structured view");
  });

  test("dashboard surface includes the post-tool rendering rule", () => {
    const prompt = buildAgentSystemPrompt({ ...base, surface: "dashboard" });
    expect(prompt).toContain("running inside the openstatus dashboard");
    expect(prompt).toContain("already renders a structured view");
    expect(prompt).not.toContain("running inside Slack");
  });

  test("asks about subscriber notifications when the plan allows it", () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      canNotifySubscribers: true,
    });
    expect(prompt).toContain("Should I notify subscribers?");
  });

  test("forces notify false and drops the question when the plan does not", () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      canNotifySubscribers: false,
    });
    expect(prompt).toContain("notify: false");
    expect(prompt).not.toContain("Should I notify subscribers?");
  });

  test("prepends the preamble only when one is provided", () => {
    const withPreamble = buildAgentSystemPrompt({
      ...base,
      preamble: "SLACK CORE.",
    });
    expect(withPreamble.startsWith("SLACK CORE.")).toBe(true);

    const withoutPreamble = buildAgentSystemPrompt(base);
    expect(withoutPreamble.startsWith("You are the openstatus assistant")).toBe(
      true,
    );
  });
});
