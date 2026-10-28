import { describe, expect, test } from "vitest";

import { pacedDuration } from "./pacing";
import { clipSegments, layoutParts, partsOf } from "./story";
import type { Timeline } from "./timeline";

const timeline = (over: Partial<Timeline> = {}): Timeline => ({
  name: "t",
  theme: "light",
  fps: 30,
  viewport: { width: 1600, height: 1000 },
  scale: 1,
  duration: 20,
  events: [{ type: "output", t: 0, t1: 20 }],
  ...over,
});

describe("clipSegments", () => {
  test("keeps the part of each segment inside the stretch", () => {
    const segments = [
      { from: 0, to: 4, rate: 1 },
      { from: 4, to: 10, rate: 3 },
    ];
    expect(clipSegments(segments, 2, 7)).toEqual([
      { from: 2, to: 4, rate: 1 },
      { from: 4, to: 7, rate: 3 },
    ]);
  });
});

describe("partsOf", () => {
  test("one part without inserts", () => {
    const parts = partsOf(timeline(), {});
    expect(parts).toHaveLength(1);
    expect(pacedDuration(parts[0].segments)).toBeCloseTo(20);
  });

  test("alternates the recording and its clips, covering it once", () => {
    const clip = timeline({ name: "clip", duration: 5 });
    const parts = partsOf(
      timeline({
        inserts: [
          { t: 8, clip: "a" },
          { t: 20, clip: "b" },
        ],
      }),
      { a: clip, b: clip },
    );
    expect(parts.map((p) => (p.kind === "clip" ? p.clip : "main"))).toEqual([
      "main",
      "a",
      "main",
      "b",
    ]);
    const main = parts.filter((p) => p.kind === "main");
    expect(main.reduce((s, p) => s + pacedDuration(p.segments), 0)).toBeCloseTo(
      20,
    );
  });

  test("fails on a clip without a timeline", () => {
    expect(() =>
      partsOf(timeline({ inserts: [{ t: 1, clip: "gone" }] }), {}),
    ).toThrow(/gone/);
  });
});

describe("layoutParts", () => {
  test("overlaps parts by the fade", () => {
    // 10s of Slack, a 5s clip, the last 10s: 300, 150 and 300 frames, each
    // starting 18 frames before the one before it ends.
    const parts = partsOf(timeline({ inserts: [{ t: 10, clip: "a" }] }), {
      a: timeline({ duration: 5 }),
    });
    const { placed, frames } = layoutParts(parts, 30, 18);
    expect(placed.map((p) => [p.from, p.frames])).toEqual([
      [0, 300],
      [282, 150],
      [414, 300],
    ]);
    expect(frames).toBe(714);
  });

  test("fails on a part shorter than its cross-fades", () => {
    const parts = partsOf(timeline({ inserts: [{ t: 19.5, clip: "a" }] }), {
      a: timeline({ duration: 5 }),
    });
    expect(() => layoutParts(parts, 30, 18)).toThrow(/part 3 \(main\)/);
  });
});
