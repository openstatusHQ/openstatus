import { describe, expect, test } from "vitest";

import {
  TYPE_RATE,
  buildSegments,
  paceOf,
  pacedDuration,
  paces,
  sourceTime,
} from "./pacing";
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

describe("terminal output", () => {
  test("plays a running command at real speed", () => {
    const run = timeline(20, [{ type: "output", t: 2, t1: 14 }]);
    const segments = buildSegments(run);
    const at = (t: number) => segments.find((s) => s.from <= t && t < s.to);
    expect(at(8)?.rate).toBe(1);
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

describe("the update pace", () => {
  const typed = timeline(20, [
    { type: "click", t: 1, at: [0, 0], box: [0, 0, 10, 10] },
    { type: "type", t: 10, t1: 14, box: [0, 0, 10, 10], text: "hello" },
  ]);

  test("is what a product update's recording plays at", () => {
    const meta = { format: "update" as const, title: "t", tagline: "s" };
    expect(paceOf({ ...typed, meta })).toBe(paces.update);
    expect(paceOf(typed)).toBe(paces.tutorial);
  });

  test("covers the recording and never plays below its own rate", () => {
    const segments = buildSegments(typed, paces.update);
    expect(segments[0].from).toBe(0);
    expect(segments.at(-1)?.to).toBe(20);
    for (let i = 1; i < segments.length; i++)
      expect(segments[i].from).toBeCloseTo(segments[i - 1].to);
    expect(Math.min(...segments.map((s) => s.rate))).toBe(paces.update.rate);
    expect(Math.max(...segments.map((s) => s.rate))).toBeLessThanOrEqual(
      paces.update.maxRate,
    );
  });

  test("is shorter than the tutorial cut of the same recording", () => {
    expect(pacedDuration(buildSegments(typed, paces.update))).toBeLessThan(
      pacedDuration(buildSegments(typed)) * 0.7,
    );
  });
});

describe("a look", () => {
  test("is followed for as long as it rests", () => {
    const read = timeline(20, [
      { type: "look", t: 8, t1: 11, box: [0, 0, 10, 10] },
    ]);
    const held = buildSegments(read).find((s) => s.from <= 8 && s.to >= 11);
    expect(held?.rate).toBe(1);
  });
});

describe("holds in the update pace", () => {
  // The camera reaches the first look at 4 and leaves for the second at 7.1.
  const read = timeline(20, [
    { type: "look", t: 4, t1: 7.5, box: [0, 0, 10, 10] },
    { type: "look", t: 8, t1: 10, box: [500, 500, 10, 10] },
  ]);
  const rateAt = (t: number) =>
    buildSegments(read, paces.update).find((s) => s.from <= t && s.to > t)
      ?.rate;

  test("play faster once the camera has arrived", () => {
    expect(rateAt(5)).toBe(paces.update.holdRate);
    expect(rateAt(9)).toBe(paces.update.holdRate);
  });

  test("leave the camera's way to the next shot at the followed rate", () => {
    expect(rateAt(7.3)).toBe(paces.update.rate);
  });

  test("do not exist in a tutorial", () => {
    const rates = buildSegments(read).map((s) => s.rate);
    expect(rates.every((r) => r === 1 || r > 1.5)).toBe(true);
    expect(buildSegments(read).find((s) => s.from <= 5 && s.to > 5)?.rate).toBe(
      1,
    );
  });
});
