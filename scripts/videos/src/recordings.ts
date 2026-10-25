import type { Timeline, TutorialMeta } from "./timeline";

// Recording folders under .recordings/remotion, from the public dir listing:
// every folder that holds a timeline.json, by name. Series order (meta.order)
// lives inside each timeline, which the composition list cannot wait for.
export function recordingsFrom(files: { name: string }[]): string[] {
  return files
    .map((f) => f.name.match(/^([\w-]+)\/timeline\.json$/)?.[1])
    .filter((name): name is string => Boolean(name))
    .sort();
}

// Recordings a thumbnail can be drawn from: browser recordings with a
// thumbnail.png (recorded since thumbnails), and terminal recordings, whose
// screens are drawn directly.
export function thumbnailsFrom(files: { name: string }[]): string[] {
  const names = new Set(files.map((f) => f.name));
  return recordingsFrom(files).filter(
    (r) => names.has(`${r}/thumbnail.png`) || names.has(`${r}/terminal.json`),
  );
}

// The words around a video. Recordings made before tutorials exported `meta`
// still render, titled after their file name.
export function copyOf(timeline: Timeline): TutorialMeta {
  if (timeline.meta) return timeline.meta;
  const title = timeline.name.replace(/-/g, " ");
  return {
    order: 0,
    label: "Tutorial",
    title: title[0].toUpperCase() + title.slice(1),
    subtitle: "",
    outroTitle: "That's it.",
    outroSubtitle: "",
  };
}
