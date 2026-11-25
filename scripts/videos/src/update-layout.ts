import { FADE, layoutParts, partsOf } from "./story";
import type { Timeline } from "./timeline";

export const HOOK = 2.1;
export const END = 2.8;
// The recording opens out of the hook, and closes into the end card, through
// a circle that takes this long.
export const IRIS = 0.55;

// A 9:16 cut plays in a feed that draws its own interface over the top and
// bottom of the frame; copy stays between them.
export const FEED = { top: 240, bottom: 420 };
export const isTall = (frame: { width: number; height: number }) =>
  frame.height > frame.width;

// Section lengths in whole frames, as `sections` in video.tsx gives a
// tutorial's.
export function updateSections(
  timeline: Timeline,
  clips: Record<string, Timeline>,
  fps: number,
) {
  const hook = Math.round(HOOK * fps);
  const iris = Math.round(IRIS * fps);
  const parts = layoutParts(
    partsOf(timeline, clips),
    fps,
    Math.round(FADE * fps),
  );
  const body = parts.frames;
  const end = Math.round(END * fps);
  const bodyStart = hook - iris;
  const endStart = bodyStart + body - iris;
  return {
    hook,
    iris,
    body,
    end,
    bodyStart,
    endStart,
    parts: parts.placed,
    total: endStart + end,
  };
}
