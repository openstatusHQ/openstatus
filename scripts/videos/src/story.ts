import { buildSegments, pacedDuration, type Segment } from "./pacing";
import type { Timeline } from "./timeline";

// What a video's body plays, in order: a recording through its own pacing.
// Most recordings are one part; a Slack recording with dashboard clips cut
// in is the Slack parts and the clips, alternating.
export type Part =
  | { kind: "main"; segments: Segment[] }
  | { kind: "clip"; clip: string; timeline: Timeline; segments: Segment[] };

// The stretch of a paced recording between two source times.
export function clipSegments(
  segments: Segment[],
  from: number,
  to: number,
): Segment[] {
  return segments
    .map((s) => ({
      ...s,
      from: Math.max(s.from, from),
      to: Math.min(s.to, to),
    }))
    .filter((s) => s.to > s.from);
}

export function partsOf(
  timeline: Timeline,
  clips: Record<string, Timeline>,
): Part[] {
  const segments = buildSegments(timeline);
  const parts: Part[] = [];
  let from = 0;
  for (const insert of timeline.inserts ?? []) {
    const clip = clips[insert.clip];
    if (!clip) throw new Error(`no timeline for clip ${insert.clip}`);
    parts.push({
      kind: "main",
      segments: clipSegments(segments, from, insert.t),
    });
    parts.push({
      kind: "clip",
      clip: insert.clip,
      timeline: clip,
      segments: buildSegments(clip),
    });
    from = insert.t;
  }
  parts.push({
    kind: "main",
    segments: clipSegments(segments, from, timeline.duration),
  });
  // A cut at the very start or end leaves an empty Slack part behind.
  return parts.filter((p) => pacedDuration(p.segments) > 0);
}

// Part lengths and starts in whole frames; parts overlap by `fade` to
// cross-fade. A part must outlast its fades in and out, or the next part
// would start before it shows: cut the story further apart instead.
export function layoutParts(parts: Part[], fps: number, fade: number) {
  let start = 0;
  const placed = parts.map((part, i) => {
    const frames = Math.ceil(pacedDuration(part.segments) * fps);
    if (parts.length > 1 && frames < 2 * fade)
      throw new Error(
        `part ${i + 1} (${part.kind === "clip" ? part.clip : "main"}) is ${frames} frames, shorter than its cross-fades (${2 * fade})`,
      );
    const at = start;
    start += frames - fade;
    return { part, from: at, frames };
  });
  const last = placed.at(-1);
  return { placed, frames: last ? last.from + last.frames : 0 };
}
