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

export type Timeline = {
  name: string;
  // "terminal" recordings (scripts/record-terminal.mjs) keep their screens in
  // terminal.json, and their viewport counts character cells, not pixels.
  kind?: "page" | "terminal";
  meta?: TutorialMeta;
  theme: "light" | "dark";
  fps: number;
  viewport: { width: number; height: number };
  scale: number;
  duration: number;
  // The element thumbnail.png should keep in frame, if the tutorial named one.
  thumbnail?: { focus: Rect | null };
  events: TimelineEvent[];
};

export const eventsOf = <T extends TimelineEvent["type"]>(
  timeline: Timeline,
  type: T,
) =>
  timeline.events.filter(
    (e): e is Extract<TimelineEvent, { type: T }> => e.type === type,
  );
