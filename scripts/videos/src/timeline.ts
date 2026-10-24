// Mirrors what scripts/record.mjs writes; times are seconds from video start,
// positions are CSS pixels in the recorded viewport.
export type Point = [number, number];
export type Rect = [x: number, y: number, width: number, height: number];

export type TimelineEvent =
  | { type: "move"; t: number; t1: number; from: Point; to: Point }
  | { type: "click"; t: number; at: Point; box: Rect }
  | { type: "type"; t: number; t1: number; box: Rect; text: string }
  | { type: "step"; t: number; label: string }
  | { type: "nav"; t: number; url: string };

export type Timeline = {
  name: string;
  theme: "light" | "dark";
  fps: number;
  viewport: { width: number; height: number };
  scale: number;
  duration: number;
  events: TimelineEvent[];
};

export const eventsOf = <T extends TimelineEvent["type"]>(
  timeline: Timeline,
  type: T,
) =>
  timeline.events.filter(
    (e): e is Extract<TimelineEvent, { type: T }> => e.type === type,
  );
