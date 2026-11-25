import { describe, expect, test } from "vitest";

import {
  agentStateAt,
  inlineRuns,
  streamed,
  type ActivityItem,
  type AgentData,
} from "./agent-data";

const data: AgentData = {
  title: "t",
  client: { user: "u", plan: "p", model: "m", recents: [] },
  toolCount: 2,
  events: [
    { t: 0, op: "compose", text: "hi" },
    { t: 1, op: "compose", text: "" },
    { t: 1, op: "message", id: 1, text: "hi" },
    { t: 2, op: "activity", id: 2, label: "Checked" },
    { t: 2, op: "call", id: 3, activity: 2, name: "list_monitors", input: {} },
    { t: 3, op: "result", id: 3, summary: "4 monitors" },
    {
      t: 4,
      op: "call",
      id: 4,
      activity: 2,
      name: "declare_incident",
      input: { a: 1 },
    },
    { t: 4, op: "approval", id: 4 },
    { t: 6, op: "allow", id: 4 },
    { t: 7, op: "result", id: 4, summary: "Declared" },
    { t: 7, op: "settled", id: 2 },
    { t: 8, op: "reveal", id: 2 },
    { t: 9, op: "text", id: 5, t1: 11, text: "one two three four" },
    { t: 12, op: "activity", id: 6, label: "Published" },
    { t: 13, op: "settled", id: 6 },
    { t: 14, op: "text", id: 7, t1: 15, text: "done" },
  ],
};

const activityAt = (t: number) =>
  agentStateAt(data, t).items.find(
    (i): i is ActivityItem => i.kind === "activity" && i.id === 2,
  );
const lastTool = (t: number) => activityAt(t)?.tools.at(-1);

describe("agentStateAt", () => {
  test("the composer holds the draft until the message is sent", () => {
    expect(agentStateAt(data, 0.5).compose).toBe("hi");
    const sent = agentStateAt(data, 1);
    expect(sent.compose).toBe("");
    expect(sent.items).toEqual([{ kind: "user", id: 1, text: "hi" }]);
  });

  test("tool calls fold into their section, not the thread", () => {
    const { items } = agentStateAt(data, 5);
    expect(items.map((i) => i.kind)).toEqual(["user", "activity"]);
    expect(activityAt(5)?.tools).toHaveLength(2);
  });

  test("a section settles, and knows ahead when it is opened", () => {
    expect(activityAt(5)).toMatchObject({ settled: false, revealAt: 8 });
    expect(activityAt(7)).toMatchObject({ settled: true, revealAt: 8 });
  });

  test("a call runs, then shows its result", () => {
    expect(lastTool(2.5)?.status).toBe("running");
    expect(lastTool(3)).toMatchObject({
      status: "done",
      summary: "4 monitors",
      needsApproval: false,
    });
  });

  test("a write waits for approval, then runs", () => {
    expect(lastTool(5)).toMatchObject({
      status: "approval",
      needsApproval: true,
      allowedAt: null,
      clickAt: 6,
    });
    expect(lastTool(6.5)).toMatchObject({ status: "running", allowedAt: 6 });
    expect(lastTool(7)).toMatchObject({ status: "done", needsApproval: true });
  });

  test("thinks only when nothing on screen is moving", () => {
    expect(agentStateAt(data, 1.5).thinking).toBe(true);
    expect(agentStateAt(data, 5).thinking).toBe(false);
    expect(agentStateAt(data, 7.5).thinking).toBe(false);
    expect(agentStateAt(data, 13.5).thinking).toBe(true);
    expect(agentStateAt(data, 16).thinking).toBe(false);
  });

  test("streams a reply across its span", () => {
    const at = (t: number) =>
      agentStateAt(data, t).items.find((i) => i.id === 5);
    expect(at(10)).toMatchObject({ kind: "text", streaming: true });
    expect(at(11)).toEqual({
      kind: "text",
      id: 5,
      text: "one two three four",
      streaming: false,
    });
  });
});

describe("streamed", () => {
  test("never cuts a word", () => {
    expect(streamed("one two three", 0.5)).toBe("one");
    expect(streamed("one two three", 0.6)).toBe("one two");
    expect(streamed("one two three", 0.1)).toBe("");
  });

  test("gives the whole text at the end", () => {
    expect(streamed("one two", 1)).toBe("one two");
  });
});

describe("inlineRuns", () => {
  test("splits bold and code from plain text", () => {
    expect(inlineRuns("**API** in `ams` now")).toEqual([
      { text: "API", style: "bold" },
      { text: " in ", style: "plain" },
      { text: "ams", style: "code" },
      { text: " now", style: "plain" },
    ]);
  });

  test("leaves an unclosed mark as plain text", () => {
    expect(inlineRuns("a **b")).toEqual([{ text: "a **b", style: "plain" }]);
  });
});
