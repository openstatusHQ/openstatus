// What scripts/record-agent.mjs writes to agent.json. Times are seconds.
export type AgentEvent = { t: number } & (
  | { op: "compose"; text: string }
  | { op: "message"; id: number; text: string }
  | { op: "text"; id: number; t1: number; text: string }
  | { op: "activity"; id: number; label: string }
  | { op: "settled"; id: number }
  | { op: "reveal"; id: number }
  | {
      op: "call";
      id: number;
      activity: number | null;
      name: string;
      input: Record<string, unknown>;
    }
  | { op: "approval"; id: number }
  | { op: "allow"; id: number }
  | { op: "result"; id: number; summary: string }
);

// The app's chrome: who is signed in and what the sidebar lists.
export type AgentClient = {
  user: string;
  plan: string;
  model: string;
  recents: string[];
};

export type AgentData = {
  title: string;
  client: AgentClient;
  toolCount: number;
  events: AgentEvent[];
};

export type ToolItem = {
  kind: "tool";
  id: number;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "approval" | "done";
  // When the viewer's approval landed, and when the result did.
  allowedAt: number | null;
  // When that click happens, known before it does so the cursor can get there.
  clickAt: number | null;
  doneAt: number | null;
  needsApproval: boolean;
  summary: string;
};

// Consecutive tool calls, folded into one line the way the app shows them.
export type ActivityItem = {
  kind: "activity";
  id: number;
  label: string;
  settled: boolean;
  // When the viewer opens it, known ahead so the cursor can get there.
  revealAt: number | null;
  tools: ToolItem[];
};

export type AgentItem =
  | { kind: "user"; id: number; text: string }
  | { kind: "text"; id: number; text: string; streaming: boolean }
  | ActivityItem;

export type AgentState = {
  compose: string;
  items: AgentItem[];
  // The agent owes an answer and nothing on screen is moving yet.
  thinking: boolean;
};

// Whole words only, the way a stream reads; a word cut in half looks like a bug.
export function streamed(text: string, progress: number): string {
  if (progress >= 1) return text;
  const end = Math.floor(text.length * Math.max(progress, 0));
  const cut = text.lastIndexOf(" ", end);
  return cut === -1 ? "" : text.slice(0, cut);
}

export function agentStateAt(data: AgentData, t: number): AgentState {
  let compose = "";
  const items: AgentItem[] = [];
  const activity = (id: number | null) =>
    items.find((i): i is ActivityItem => i.kind === "activity" && i.id === id);
  const tool = (id: number) =>
    items
      .filter((i): i is ActivityItem => i.kind === "activity")
      .flatMap((i) => i.tools)
      .find((i) => i.id === id);
  for (const e of data.events) {
    if (e.t > t) break;
    switch (e.op) {
      case "compose":
        compose = e.text;
        break;
      case "message":
        items.push({ kind: "user", id: e.id, text: e.text });
        break;
      case "text":
        items.push({
          kind: "text",
          id: e.id,
          text: streamed(e.text, (t - e.t) / (e.t1 - e.t)),
          streaming: t < e.t1,
        });
        break;
      case "activity":
        items.push({
          kind: "activity",
          id: e.id,
          label: e.label,
          settled: false,
          revealAt:
            data.events.find((a) => a.op === "reveal" && a.id === e.id)?.t ??
            null,
          tools: [],
        });
        break;
      case "settled": {
        const item = activity(e.id);
        if (item) item.settled = true;
        break;
      }
      case "call":
        activity(e.activity)?.tools.push({
          kind: "tool",
          id: e.id,
          name: e.name,
          input: e.input,
          status: "running",
          allowedAt: null,
          clickAt:
            data.events.find((a) => a.op === "allow" && a.id === e.id)?.t ??
            null,
          doneAt: null,
          needsApproval: false,
          summary: "",
        });
        break;
      case "approval": {
        const item = tool(e.id);
        if (item) {
          item.status = "approval";
          item.needsApproval = true;
        }
        break;
      }
      case "allow": {
        const item = tool(e.id);
        if (item) {
          item.status = "running";
          item.allowedAt = e.t;
        }
        break;
      }
      case "result": {
        const item = tool(e.id);
        if (item) {
          item.status = "done";
          item.doneAt = e.t;
          item.summary = e.summary;
        }
        break;
      }
    }
  }
  const last = items.at(-1);
  const pending = data.events.some((e) => e.t > t && e.op !== "compose");
  const thinking =
    pending &&
    !compose &&
    (last?.kind === "user" ||
      (last?.kind === "activity" && last.settled && last.revealAt === null));
  return { compose, items, thinking };
}

export type InlineRun = { text: string; style: "plain" | "bold" | "code" };

// The two marks replies use. An unclosed mark mid-stream stays plain text until
// its end arrives, so it does not flash while streaming.
export function inlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at)
      runs.push({ text: text.slice(at, match.index), style: "plain" });
    runs.push(
      match[1] !== undefined
        ? { text: match[1], style: "bold" }
        : { text: match[2], style: "code" },
    );
    at = match.index + match[0].length;
  }
  if (at < text.length) runs.push({ text: text.slice(at), style: "plain" });
  return runs;
}
