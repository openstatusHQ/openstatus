import { describe, expect, test } from "vitest";

import {
  buildShots,
  cameraAt,
  cursorAt,
  travelSpans,
  type Project,
  type Shot,
  type Tall,
} from "./camera";
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

describe("a look", () => {
  const read = timeline([
    { type: "look", t: 4, t1: 6, box: [900, 500, 120, 16] },
  ]);
  const shots = buildShots(read, scene, project, scale);

  test("moves in on what is read and holds there", () => {
    expect(cameraAt(shots, 4, scene).zoom).toBeGreaterThan(2);
    expect(cameraAt(shots, 6, scene).zoom).toBe(cameraAt(shots, 4, scene).zoom);
    expect(cameraAt(shots, 4, scene).x).toBeCloseTo(960);
  });
});

describe("a 9:16 scene", () => {
  const frame = { width: 1080, height: 1920 };
  // A 1440×900 window fitted to the width.
  const tall: Tall = { rows: [650, 1270], keep: [570, 1150] };
  const at = (y: number, zoom: number) => {
    const shots: Shot[] = [{ t: 0, x: 540, y, zoom }];
    const camera = cameraAt(shots, 0, frame, tall);
    const onScreen = (sceneY: number) =>
      (sceneY - camera.y) * zoom + frame.height / 2;
    return { camera, target: onScreen(y), top: onScreen(tall.rows[0]) };
  };

  test("moves in further than 16:9 by its reach", () => {
    const clicked = timeline([
      { type: "click", t: 3, at: [100, 100], box: [80, 90, 40, 20] },
    ]);
    const [, near] = buildShots(clicked, frame, project, scale);
    const [, nearer] = buildShots(clicked, frame, project, scale, 1.5);
    expect(nearer.zoom).toBeCloseTo(near.zoom * 1.5);
  });

  test("keeps the window in the middle while it is shorter than the frame", () => {
    expect(at(900, 2).camera.y).toBe(960);
  });

  test("fills the frame with the window once it is taller", () => {
    expect(at(800, 4).top).toBeCloseTo(0);
  });

  test("gives that up to keep the target between title and caption", () => {
    expect(at(660, 4).target).toBeCloseTo(570);
    expect(at(1260, 4).target).toBeCloseTo(1150);
    expect(at(700, 2).target).toBeCloseTo(570);
  });
});

describe("travelSpans", () => {
  test("ends on each shot and never starts before the one before it", () => {
    const spans = travelSpans(
      timeline([
        { type: "click", t: 3, at: [0, 0], box: [0, 0, 10, 10] },
        { type: "click", t: 3.5, at: [0, 0], box: [0, 0, 10, 10] },
      ]),
    );
    expect(spans).toEqual([
      [2.1, 3],
      [3, 3.5],
      [7.9, 8.8],
    ]);
  });
});
