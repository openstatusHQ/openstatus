import { describe, expect, test } from "vitest";

import { TYPE_RATE, buildSegments, pacedDuration, sourceTime } from "./pacing";
import type { Timeline, TimelineEvent } from "./timeline";

const timeline = (duration: number, events: TimelineEvent[]): Timeline => ({
  name: "test",
  theme: "light",
  fps: 30,
  viewport: { width: 1440, height: 900 },
  scale: 2,
  duration,
  events,
});

// Two clicks with a long idle stretch between them.
const idle = timeline(20, [
  { type: "click", t: 1, at: [0, 0], box: [0, 0, 10, 10] },
  { type: "click", t: 12, at: [0, 0], box: [0, 0, 10, 10] },
]);

describe("buildSegments", () => {
  test("covers the recording without gaps or overlaps", () => {
    const segments = buildSegments(idle);
    expect(segments[0].from).toBe(0);
    expect(segments.at(-1)?.to).toBe(20);
    for (let i = 1; i < segments.length; i++)
      expect(segments[i].from).toBeCloseTo(segments[i - 1].to);
  });

  test("speeds up long idle stretches, never past 4x", () => {
    const rates = buildSegments(idle).map((s) => s.rate);
    expect(Math.max(...rates)).toBe(4);
    expect(rates.every((r) => r >= 1)).toBe(true);
  });

  test("keeps activity at real speed", () => {
    const busy = buildSegments(idle).find((s) => s.from <= 12 && s.to >= 12.5);
    expect(busy?.rate).toBe(1);
  });

  test("leaves a recording with no idle time untouched", () => {
    const dense = timeline(3, [
      { type: "move", t: 0, t1: 3, from: [0, 0], to: [1, 1] },
    ]);
    expect(pacedDuration(buildSegments(dense))).toBeCloseTo(3);
  });
});

describe("sourceTime", () => {
  const segments = buildSegments(idle);

  test("starts at zero and ends at the recording's end", () => {
    expect(sourceTime(segments, 0)).toBe(0);
    expect(sourceTime(segments, pacedDuration(segments) + 5)).toBe(20);
  });

  test("is continuous and increasing across rate boundaries", () => {
    const total = pacedDuration(segments);
    let previous = sourceTime(segments, 0);
    for (let t = 1 / 30; t <= total; t += 1 / 30) {
      const s = sourceTime(segments, t);
      expect(s).toBeGreaterThan(previous);
      expect(s - previous).toBeLessThanOrEqual(4 / 30 + 1e-9);
      previous = s;
    }
  });

  test("maps each segment's output start to its source start", () => {
    let out = 0;
    for (const s of segments) {
      expect(sourceTime(segments, out)).toBeCloseTo(s.from);
      out += (s.to - s.from) / s.rate;
    }
  });
});

describe("typing", () => {
  const typed = timeline(10, [
    { type: "click", t: 1, at: [0, 0], box: [0, 0, 10, 10] },
    { type: "type", t: 1.5, t1: 4.5, box: [0, 0, 10, 10], text: "hello" },
  ]);

  test("plays exactly the typed span faster", () => {
    const fast = buildSegments(typed).filter((s) => s.rate === TYPE_RATE);
    expect(fast).toHaveLength(1);
    expect(fast[0].from).toBeCloseTo(1.5);
    expect(fast[0].to).toBeCloseTo(4.5);
  });

  test("shortens the video by the time saved while typing", () => {
    const withoutTyping = timeline(10, [
      { type: "click", t: 1, at: [0, 0], box: [0, 0, 10, 10] },
      { type: "move", t: 1.5, t1: 4.5, from: [0, 0], to: [1, 1] },
    ]);
    const saved =
      pacedDuration(buildSegments(withoutTyping)) -
      pacedDuration(buildSegments(typed));
    expect(saved).toBeCloseTo(3 - 3 / TYPE_RATE);
  });

  test("leaves sped-up idle stretches alone", () => {
    const rates = buildSegments(idle).map((s) => s.rate);
    expect(rates).not.toContain(TYPE_RATE);
  });
});
