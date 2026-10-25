import { AbsoluteFill, Img, staticFile } from "remotion";

import { Mark, palette } from "./brand";
import { fonts } from "./fonts";
import { panFor } from "./pan";
import { copyOf } from "./recordings";
import type { Timeline } from "./timeline";

// 1920×1080: copy on the left, the dashboard in its window on the right,
// running off the right and bottom edges.
const PAD = 100;
const TOP = 112;
const WINDOW_X = 880;
const WINDOW_Y = 128;
// Thumbnails are seen small; the UI is drawn larger than 1:1 to stay legible.
const ZOOM = 1.1;
const GRID = 76;

export type ThumbnailProps = {
  recording: string;
  timeline: Timeline | null;
};

export function Thumbnail({ recording, timeline }: ThumbnailProps) {
  if (!timeline) return null;
  const colors = palette.light;
  const copy = copyOf(timeline);
  const { width: vw, height: vh } = timeline.viewport;
  const visibleW = (1920 - WINDOW_X) / ZOOM;
  const visibleH = (1080 - WINDOW_Y) / ZOOM;
  const focus = timeline.thumbnail?.focus;
  const dx = focus ? panFor(focus[0], focus[2], vw, visibleW) : 0;
  const dy = focus ? panFor(focus[1], focus[3], vh, visibleH) : 0;
  const line = "rgb(0 0 0 / 0.045)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.stage,
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: `${GRID}px ${GRID}px`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: PAD,
          top: TOP,
          width: WINDOW_X - PAD - 60,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontFamily: fonts.mono,
            fontSize: 36,
            color: colors.muted,
          }}
        >
          <Mark size={48} color={colors.foreground} />
          {String(copy.order).padStart(2, "0")} · {copy.label}
        </div>
        <div
          style={{
            marginTop: 52,
            fontFamily: fonts.display,
            fontSize: 112,
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: colors.foreground,
          }}
        >
          {copy.thumbTitle ?? copy.title}
        </div>
        <div
          style={{
            marginTop: 48,
            fontFamily: fonts.mono,
            fontSize: 32,
            lineHeight: 1.45,
            color: colors.muted,
          }}
        >
          {copy.thumbSubtitle ?? copy.subtitle}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: WINDOW_X,
          top: WINDOW_Y,
          width: vw * ZOOM,
          height: vh * ZOOM,
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: colors.background,
          boxShadow: `0 0 0 1px ${colors.border}, ${colors.shadow}`,
        }}
      >
        <Img
          src={staticFile(`${recording}/thumbnail.png`)}
          style={{
            width: vw * ZOOM,
            height: vh * ZOOM,
            transform: `translate(${-dx * ZOOM}px, ${-dy * ZOOM}px)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
