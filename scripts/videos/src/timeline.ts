// Mirrors what scripts/record.mjs writes; times are seconds from video start,
// positions are CSS pixels in the recorded viewport.
export type Point = [number, number];
export type Rect = [x: number, y: number, width: number, height: number];

export type TimelineEvent =
  | { type: "move"; t: number; t1: number; from: Point; to: Point }
  | { type: "click"; t: number; at: Point; box: Rect }
  | { type: "type"; t: number; t1: number; box: Rect; text: string }
  | { type: "step"; t: number; label: string }
  | { type: "scroll"; t: number; t1: number; dy: number }
  // The viewer rests on an element to read it.
  | { type: "look"; t: number; t1: number; box: Rect }
  // A command running in a terminal recording.
  | { type: "output"; t: number; t1: number }
  | { type: "nav"; t: number; url: string };

// The `meta` a tutorial exports (scripts/tutorials/lib/meta.mjs).
export type TutorialMeta = {
  order: number;
  // One word for the thumbnail's "01 · Launch" line.
  label: string;
  title: string;
  subtitle: string;
  outroTitle: string;
  outroSubtitle: string;
  // Replaces the thumbnail's "01 · Label" line, e.g. "Migrate · Instatus".
  thumbEyebrow?: string;
  thumbTitle?: string;
  thumbSubtitle?: string;
  viewport?: { width: number; height: number };
  requires?: string[];
};

// The `meta` of a product update (scripts/updates): a short cut of one
// feature, in place of a tutorial's intro and outro.
export type UpdateMeta = {
  format: "update";
  title: string;
  tagline: string;
  // Where the end card sends the viewer, after "openstatus.dev/".
  link?: string;
  viewport?: { width: number; height: number };
  requires?: string[];
};

export type Timeline = {
  name: string;
  // "terminal" recordings (scripts/record-terminal.mjs) keep their screens in
  // terminal.json, and their viewport counts character cells, not pixels;
  // "slack" ones (scripts/record-slack.mjs) keep their events in slack.json;
  // "agent" ones (scripts/record-agent.mjs) keep theirs in agent.json.
  kind?: "page" | "terminal" | "slack" | "agent";
  meta?: TutorialMeta | UpdateMeta;
  theme: "light" | "dark";
  fps: number;
  viewport: { width: number; height: number };
  scale: number;
  duration: number;
  // The element thumbnail.png should keep in frame, if the tutorial named
  // one; for drawn recordings (slack), the moment to draw.
  thumbnail?: { focus: Rect | null; t?: number };
  events: TimelineEvent[];
  // Dashboard clips cut into a Slack recording (record-slack.mjs
  // --dashboard): at Slack time `t`, play the browser recording in the
  // folder `clip` next to this timeline.
  inserts?: { t: number; clip: string }[];
};

export const eventsOf = <T extends TimelineEvent["type"]>(
  timeline: Timeline,
  type: T,
) =>
  timeline.events.filter(
    (e): e is Extract<TimelineEvent, { type: T }> => e.type === type,
  );

export const updateOf = (timeline: Timeline): UpdateMeta | null =>
  timeline.meta && "format" in timeline.meta ? timeline.meta : null;

export const isUpdate = (timeline: Timeline) => updateOf(timeline) !== null;
