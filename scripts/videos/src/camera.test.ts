import { describe, expect, test } from "vitest";

import { buildShots, cameraAt, cursorAt, type Project } from "./camera";
import type { Timeline, TimelineEvent } from "./timeline";

const scene = { width: 1920, height: 1080 };
const scale = 1;
const project: Project = (x, y) => [x, y];

const timeline = (events: TimelineEvent[], duration = 10): Timeline => ({
  name: "test",
  theme: "light",
  fps: 30,
  viewport: { width: 1920, height: 1080 },
  scale: 2,
  duration,
  events,
});

describe("camera", () => {
  const clicked = timeline([
    { type: "click", t: 3, at: [100, 100], box: [80, 90, 40, 20] },
  ]);
  const shots = buildShots(clicked, scene, project, scale);

  test("opens and closes on the whole scene", () => {
    expect(shots[0].zoom).toBe(1);
    expect(shots.at(-1)?.zoom).toBe(1);
  });

  test("arrives on the target at the click and stays inside the scene", () => {
    const at = cameraAt(shots, 3, scene);
    expect(at.zoom).toBeGreaterThan(1);
    // A target in the corner pulls the camera to the edge, never past it.
    expect(at.x).toBeCloseTo(scene.width / (2 * at.zoom));
    expect(at.y).toBeCloseTo(scene.height / (2 * at.zoom));
  });

  test("never zooms so far that the typed field leaves the frame", () => {
    const field = (width: number) =>
      buildShots(
        timeline([
          { type: "type", t: 2, t1: 3, box: [0, 500, width, 40], text: "x" },
        ]),
        scene,
        project,
        scale,
      )[1];
    const medium = field(900);
    expect(medium.zoom).toBeGreaterThan(1);
    expect(medium.zoom * 900).toBeLessThanOrEqual(scene.width * 0.7 + 1e-6);
    // Wider than the frame allows at any zoom: stay out.
    expect(field(1800).zoom).toBe(1);
  });
});

describe("cursorAt", () => {
  const moved = timeline([
    { type: "move", t: 1, t1: 2, from: [0, 0], to: [100, 50] },
  ]);

  test("rests at the start, ends on the target, eases in between", () => {
    expect(cursorAt(moved, 0)).toEqual([0, 0]);
    expect(cursorAt(moved, 5)).toEqual([100, 50]);
    const [x] = cursorAt(moved, 1.5);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(100);
  });
});
