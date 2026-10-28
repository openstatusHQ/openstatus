import { describe, expect, test } from "vitest";

import { copyOf, recordingsFrom, thumbnailsFrom } from "./recordings";
import type { Timeline } from "./timeline";

describe("recordingsFrom", () => {
  test("lists folders holding a timeline, ignoring everything else", () => {
    expect(
      recordingsFrom([
        { name: "set-up-alerts/timeline.json" },
        { name: "set-up-alerts/video.mp4" },
        { name: "create-monitor/timeline.json" },
        { name: "notes.txt" },
        { name: "nested/deeper/timeline.json" },
      ]),
    ).toEqual(["create-monitor", "set-up-alerts"]);
  });
});

describe("thumbnailsFrom", () => {
  test("keeps recordings that have a thumbnail.png", () => {
    const files = [
      "a/timeline.json",
      "a/thumbnail.png",
      "b/timeline.json",
      "c/thumbnail.png",
    ].map((name) => ({ name }));
    expect(thumbnailsFrom(files)).toEqual(["a"]);
  });

  test("keeps Slack recordings, drawn from their events", () => {
    const files = ["s/timeline.json", "s/slack.json"].map((name) => ({ name }));
    expect(thumbnailsFrom(files)).toEqual(["s"]);
  });

  test("keeps terminal recordings, drawn from their screens", () => {
    const files = ["t/timeline.json", "t/terminal.json"].map((name) => ({
      name,
    }));
    expect(thumbnailsFrom(files)).toEqual(["t"]);
  });
});

describe("copyOf", () => {
  const timeline = {
    name: "post-status-report",
    theme: "light",
    fps: 30,
    viewport: { width: 1440, height: 900 },
    scale: 2,
    duration: 1,
    events: [],
  } satisfies Timeline;

  test("uses the tutorial's meta when the recording has it", () => {
    const meta = {
      order: 4,
      label: "Report",
      title: "Post a status report",
      subtitle: "s",
      outroTitle: "o",
      outroSubtitle: "n",
    };
    expect(copyOf({ ...timeline, meta })).toBe(meta);
  });

  test("falls back to a title from the file name", () => {
    expect(copyOf(timeline).title).toBe("Post status report");
  });
});
