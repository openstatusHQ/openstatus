import { Easing } from "remotion";

import { eventsOf, type Rect, type Timeline } from "./timeline";

// Camera position in scene pixels; zoom 1 shows the whole scene.
export type Shot = { t: number; x: number; y: number; zoom: number };
export type Bounds = { width: number; height: number };
// Maps a point of the recorded viewport into the scene.
export type Project = (x: number, y: number) => [number, number];

const CLICK_ZOOM = 1.8;
const TYPE_ZOOM = 2.2;
// Longest glide between two shots; shorter when the shots are closer.
const TRAVEL = 0.9;
// Shots closer than this collapse into the later one, so the camera does not
// twitch between a click and the typing that follows it.
const MIN_GAP = 0.35;

const ease = Easing.bezier(0.65, 0, 0.35, 1);

export function buildShots(
  timeline: Timeline,
  scene: Bounds,
  project: Project,
  scale: number,
): Shot[] {
  const overview = (t: number) => ({
    t,
    x: scene.width / 2,
    y: scene.height / 2,
    zoom: 1,
  });
  // Zoom in, but never so far that the target no longer fits the frame.
  const focus = (t: number, [x, y, w, h]: Rect, max: number): Shot => {
    const [cx, cy] = project(x + w / 2, y + h / 2);
    const zoom = Math.max(
      1,
      Math.min(
        max,
        (0.7 * scene.width) / (w * scale),
        (0.7 * scene.height) / (h * scale),
      ),
    );
    return { t, x: cx, y: cy, zoom };
  };

  const shots: Shot[] = [overview(0)];
  for (const e of timeline.events) {
    if (e.type === "click") shots.push(focus(e.t, e.box, CLICK_ZOOM));
    if (e.type === "type") shots.push(focus(e.t, e.box, TYPE_ZOOM));
    // A new page reads best in full before the next zoom, and a scroll
    // reads best from far enough out to see the page move.
    if (e.type === "nav") shots.push(overview(e.t + 0.3));
    if (e.type === "scroll") shots.push(overview(e.t + 0.1));
  }
  shots.push(overview(Math.max(0, timeline.duration - 1.2)));

  shots.sort((a, b) => a.t - b.t);
  return shots.filter((s, i) => {
    const next = shots[i + 1];
    return !next || next.t - s.t >= MIN_GAP;
  });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// The camera holds each shot, then glides into the next one so it arrives
// exactly when that event happens. Times are recording (source) seconds.
export function cameraAt(shots: Shot[], t: number, scene: Bounds): Shot {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  const from = shots[i];
  const to = shots[i + 1];

  let shot = from;
  if (to) {
    const travel = Math.min(TRAVEL, to.t - from.t);
    const p = clamp((t - (to.t - travel)) / travel, 0, 1);
    if (p > 0) {
      const k = ease(p);
      shot = {
        t,
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        // Geometric, so zooming in and out feel equally fast.
        zoom: from.zoom * (to.zoom / from.zoom) ** k,
      };
    }
  }

  const halfW = scene.width / (2 * shot.zoom);
  const halfH = scene.height / (2 * shot.zoom);
  return {
    ...shot,
    x: clamp(shot.x, halfW, scene.width - halfW),
    y: clamp(shot.y, halfH, scene.height - halfH),
  };
}

export function cursorAt(timeline: Timeline, t: number): [number, number] {
  const moves = eventsOf(timeline, "move");
  if (moves.length === 0)
    return [timeline.viewport.width / 2, timeline.viewport.height / 2];
  if (t <= moves[0].t) return moves[0].from;
  for (const m of moves) {
    if (t < m.t) break;
    if (t <= m.t1) {
      const k = ease(clamp((t - m.t) / Math.max(m.t1 - m.t, 1e-3), 0, 1));
      return [
        m.from[0] + (m.to[0] - m.from[0]) * k,
        m.from[1] + (m.to[1] - m.from[1]) * k,
      ];
    }
  }
  return moves.filter((m) => m.t1 <= t).at(-1)?.to ?? moves[0].from;
}

export function stepAt(timeline: Timeline, t: number) {
  return eventsOf(timeline, "step")
    .filter((s) => s.t <= t)
    .at(-1);
}
