import { travelSpans } from "./camera";
import { isUpdate, type Timeline } from "./timeline";

// A stretch of source time played at one rate.
export type Segment = { from: number; to: number; rate: number };

export type Pace = {
  // Padding kept at `rate` around anything the viewer should follow.
  lead: number;
  tail: number;
  // How long a page gets to settle after a navigation before it counts as idle.
  settle: number;
  // Idle stretches shorter than this are not worth speeding up.
  minIdle: number;
  // Long waits shrink towards this many seconds, never faster than maxRate.
  beat: number;
  maxRate: number;
  // The last moments (a "Saved" toast) stay at `rate` for the outro.
  holdEnd: number;
  // What the viewer follows plays at this rate.
  rate: number;
  // A look, once the camera has arrived and until it leaves, plays at this
  // rate: the viewer is waiting, not following.
  holdRate: number;
  // Keystrokes are recorded at a readable 70ms each (at --speed 1); played
  // back faster they still read, and long messages stop dominating the video.
  typeRate: number;
};

export const paces = {
  tutorial: {
    lead: 0.35,
    tail: 0.6,
    settle: 0.9,
    minIdle: 1,
    beat: 1,
    maxRate: 4,
    holdEnd: 1.5,
    rate: 1,
    holdRate: 1,
    typeRate: 1.6,
  },
  // Product updates: seen muted in a feed, so nothing waits.
  update: {
    lead: 0.2,
    tail: 0.3,
    settle: 0.6,
    minIdle: 0.5,
    beat: 0.35,
    maxRate: 8,
    holdEnd: 0.9,
    rate: 1.25,
    holdRate: 2,
    typeRate: 3.2,
  },
} satisfies Record<string, Pace>;

export const TYPE_RATE = paces.tutorial.typeRate;

export const paceOf = (timeline: Timeline): Pace =>
  isUpdate(timeline) ? paces.update : paces.tutorial;

function activity(timeline: Timeline, pace: Pace): [number, number][] {
  const spans = timeline.events.map((e): [number, number] => {
    switch (e.type) {
      case "move":
      case "type":
      case "scroll":
      case "look":
      case "output":
        return [e.t, e.t1];
      case "click":
        return [e.t, e.t + 0.5];
      case "nav":
        return [e.t, e.t + pace.settle];
      case "step":
        return [e.t, e.t + 0.6];
    }
  });
  spans.push([0, 0.8], [timeline.duration - pace.holdEnd, timeline.duration]);
  const padded = spans
    .map(([a, b]): [number, number] => [
      Math.max(0, a - pace.lead),
      Math.min(timeline.duration, b + pace.tail),
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

export function buildSegments(
  timeline: Timeline,
  pace: Pace = paces.tutorial,
): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [a, b] of activity(timeline, pace)) {
    if (a - cursor >= pace.minIdle) {
      const idle = a - cursor;
      const rate = Math.min(
        pace.maxRate,
        Math.max(pace.rate, idle / pace.beat),
      );
      segments.push({ from: cursor, to: a, rate });
    } else if (a > cursor) {
      segments.push({ from: cursor, to: a, rate: pace.rate });
    }
    segments.push({ from: a, to: b, rate: pace.rate });
    cursor = b;
  }
  if (cursor < timeline.duration)
    segments.push({ from: cursor, to: timeline.duration, rate: pace.rate });
  return retime(segments, timeline, pace);
}

type Span = readonly [number, number];
const within = (spans: Span[], t: number) =>
  spans.some(([a, b]) => t > a && t < b);

// Cut followed segments where typing and holds begin and end: typing plays
// faster, and so does a hold, but never the camera's way to the next shot.
function retime(segments: Segment[], timeline: Timeline, pace: Pace) {
  const typing = timeline.events.flatMap((e): Span[] =>
    e.type === "type" ? [[e.t, e.t1]] : [],
  );
  const looks =
    pace.holdRate === pace.rate
      ? []
      : timeline.events.flatMap((e): Span[] =>
          e.type === "look" ? [[e.t, e.t1]] : [],
        );
  const travel: Span[] = looks.length ? travelSpans(timeline) : [];
  const cuts = [...typing, ...looks, ...travel].flat();
  return segments.flatMap((s) => {
    if (s.rate !== pace.rate) return [s];
    const edges = [
      s.from,
      ...cuts.filter((t) => t > s.from && t < s.to).sort((a, b) => a - b),
      s.to,
    ];
    return edges.slice(1).flatMap((to, i) => {
      const from = edges[i];
      if (to === from) return [];
      const mid = (from + to) / 2;
      const rate = within(typing, mid)
        ? pace.typeRate
        : within(looks, mid) && !within(travel, mid)
          ? pace.holdRate
          : pace.rate;
      return [{ from, to, rate }];
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
