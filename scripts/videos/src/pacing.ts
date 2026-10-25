import type { Timeline } from "./timeline";

// A stretch of source time played at one rate.
export type Segment = { from: number; to: number; rate: number };

// Padding kept at real speed around anything the viewer should follow.
const LEAD = 0.35;
const TAIL = 0.6;
// How long a page gets to settle after a navigation before it counts as idle.
const SETTLE = 0.9;
// Idle stretches shorter than this are not worth speeding up.
const MIN_IDLE = 1;
const MAX_RATE = 4;
// The last moments (a "Saved" toast) stay at real speed for the outro.
const HOLD_END = 1.5;
// Keystrokes are recorded at a readable 70ms each (at --speed 1); played back
// faster they still read, and long messages stop dominating the video.
export const TYPE_RATE = 1.6;

function activity(timeline: Timeline): [number, number][] {
  const spans = timeline.events.map((e): [number, number] => {
    switch (e.type) {
      case "move":
      case "type":
      case "scroll":
      case "output":
        return [e.t, e.t1];
      case "click":
        return [e.t, e.t + 0.5];
      case "nav":
        return [e.t, e.t + SETTLE];
      case "step":
        return [e.t, e.t + 0.6];
    }
  });
  spans.push([0, 0.8], [timeline.duration - HOLD_END, timeline.duration]);
  const padded = spans
    .map(([a, b]): [number, number] => [
      Math.max(0, a - LEAD),
      Math.min(timeline.duration, b + TAIL),
    ])
    .sort((x, y) => x[0] - y[0]);

  const merged: [number, number][] = [];
  for (const span of padded) {
    const last = merged.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  return merged;
}

export function buildSegments(timeline: Timeline): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [a, b] of activity(timeline)) {
    if (a - cursor >= MIN_IDLE) {
      const idle = a - cursor;
      // Long waits shrink towards a one-second beat, never faster than MAX_RATE.
      const rate = Math.min(MAX_RATE, Math.max(1, idle / 1));
      segments.push({ from: cursor, to: a, rate });
    } else if (a > cursor) {
      segments.push({ from: cursor, to: a, rate: 1 });
    }
    segments.push({ from: a, to: b, rate: 1 });
    cursor = b;
  }
  if (cursor < timeline.duration)
    segments.push({ from: cursor, to: timeline.duration, rate: 1 });
  return speedUpTyping(segments, timeline);
}

// Cut real-speed segments at typing boundaries and play the typing faster.
function speedUpTyping(segments: Segment[], timeline: Timeline): Segment[] {
  const typing = timeline.events.flatMap((e) =>
    e.type === "type" ? [[e.t, e.t1] as const] : [],
  );
  return segments.flatMap((s) => {
    if (s.rate !== 1) return [s];
    const cuts = typing
      .flatMap(([a, b]) => [a, b])
      .filter((t) => t > s.from && t < s.to);
    const edges = [s.from, ...cuts, s.to];
    return edges.slice(1).map((to, i) => {
      const from = edges[i];
      const mid = (from + to) / 2;
      const typed = typing.some(([a, b]) => mid > a && mid < b);
      return { from, to, rate: typed ? TYPE_RATE : 1 };
    });
  });
}

export const pacedDuration = (segments: Segment[]) =>
  segments.reduce((sum, s) => sum + (s.to - s.from) / s.rate, 0);

// Output seconds since the body started → source seconds in the recording.
export function sourceTime(segments: Segment[], t: number): number {
  let out = 0;
  for (const s of segments) {
    const length = (s.to - s.from) / s.rate;
    if (t < out + length) return s.from + (t - out) * s.rate;
    out += length;
  }
  return segments.at(-1)?.to ?? 0;
}
