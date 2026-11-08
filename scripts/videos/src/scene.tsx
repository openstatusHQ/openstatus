import { createContext, useContext, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { palette } from "./brand";
import {
  buildShots,
  cameraAt,
  cursorAt,
  stepAt,
  type Project,
  type Tall,
} from "./camera";
import { fonts } from "./fonts";
import { sourceTime, type Segment } from "./pacing";
import { eventsOf, type Timeline } from "./timeline";
import { FEED, isTall } from "./update-layout";

// Share of the frame the window takes at most when the camera is fully out.
const WINDOW_HEIGHT = 0.84;
const WINDOW_WIDTH = 0.92;
const RIPPLE = 0.5;
export const CAPTION_FADE = 0.25;
// Product updates draw their captions larger and pop them in.
export const CaptionLook = createContext<"tutorial" | "update">("tutorial");
const pop = Easing.out(Easing.back(2.4));

// Where the recorded viewport sits in the frame, and how to map into it.
function layout(timeline: Timeline, width: number, height: number) {
  const { width: vw, height: vh } = timeline.viewport;
  const scale = Math.min(
    (height * WINDOW_HEIGHT) / vh,
    (width * WINDOW_WIDTH) / vw,
  );
  const x = (width - vw * scale) / 2;
  const y = (height - vh * scale) / 2;
  const project: Project = (px, py) => [x + px * scale, y + py * scale];
  // A 9:16 frame fits the window to its width, which shows it smaller than
  // 16:9 does; the camera moves in that much further to make up for it.
  const reach = (Math.min(width, height) * WINDOW_HEIGHT) / vh / scale;
  // The target stays between the title and the caption, with room for a
  // menu or hover card to open under it.
  const tall: Tall | undefined = isTall({ width, height })
    ? {
        rows: [y, y + vh * scale],
        keep: [FEED.top + 330, height - FEED.bottom - 350],
      }
    : undefined;
  return { scale, x, y, project, reach, tall, scene: { width, height } };
}

// The recording in a window on the stage, under a camera that follows the
// timeline. Its own frames count from the start of the body.
export function Scene({
  recording,
  timeline,
  segments,
}: {
  recording: string;
  timeline: Timeline;
  segments: Segment[];
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colors = palette[timeline.theme];
  const { width: vw, height: vh } = timeline.viewport;

  const { scale, scene, tall, ...origin } = layout(timeline, width, height);
  const shots = useMemo(() => {
    const l = layout(timeline, width, height);
    return buildShots(timeline, l.scene, l.project, l.scale, l.reach);
  }, [timeline, width, height]);

  const t = sourceTime(segments, frame / fps);
  const camera = cameraAt(shots, t, scene, tall);
  const [cx, cy] = cursorAt(timeline, t);
  const ripples = eventsOf(timeline, "click").filter(
    (c) => t >= c.t && t < c.t + RIPPLE,
  );
  const step = stepAt(timeline, t);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate(${width / 2}px, ${height / 2}px) scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: origin.x,
            top: origin.y,
            width: vw,
            height: vh,
            transformOrigin: "0 0",
            transform: `scale(${scale})`,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: `0 0 0 1px ${colors.border}, ${colors.shadow}`,
            backgroundColor: colors.background,
          }}
        >
          {/* Seek by shifting a sequence, not with <Freeze>: Remotion clamps a
              frozen frame to the composition length, and a paced video is
              shorter than its recording, so its tail would stand still. */}
          <Sequence from={frame - Math.round(t * fps)} layout="none">
            <OffthreadVideo
              src={staticFile(`${recording}/video.mp4`)}
              style={{ width: vw, height: vh }}
              muted
            />
          </Sequence>
          {ripples.map((c) => {
            const p = (t - c.t) / RIPPLE;
            return (
              <div
                key={c.t}
                style={{
                  position: "absolute",
                  left: c.at[0] - 18,
                  top: c.at[1] - 18,
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  background: "rgb(59 130 246 / 0.35)",
                  opacity: interpolate(p, [0, 1], [1, 0]),
                  transform: `scale(${interpolate(p, [0, 1], [0.3, 1.4])})`,
                }}
              />
            );
          })}
          <Cursor
            x={cx}
            y={cy}
            zoom={camera.zoom}
            pressed={ripples.length > 0}
          />
        </div>
      </div>
      {step && (
        <Caption
          key={step.t}
          label={step.label}
          opacity={interpolate(t - step.t, [0, CAPTION_FADE], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          theme={timeline.theme}
        />
      )}
    </AbsoluteFill>
  );
}

export function Caption({
  label,
  opacity,
  theme,
}: {
  label: string;
  opacity: number;
  theme: Timeline["theme"];
}) {
  const colors = palette[theme];
  const update = useContext(CaptionLook) === "update";
  const tall = isTall(useVideoConfig());
  const k = pop(opacity);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: tall ? FEED.bottom : update ? 50 : 44,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: update
          ? `translateY(${(1 - opacity) * 18}px) scale(${0.7 + 0.3 * k}) rotate(${(1 - k) * -4}deg)`
          : `translateY(${(1 - opacity) * 8}px)`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.sans,
          fontWeight: 500,
          fontSize: tall ? 46 : update ? 36 : 26,
          padding: tall ? "20px 40px" : update ? "16px 32px" : "12px 22px",
          // A caption that wraps is no longer a pill.
          borderRadius: tall ? 46 : 9999,
          maxWidth: tall ? 880 : undefined,
          lineHeight: tall ? 1.2 : undefined,
          textAlign: "center",
          textWrap: "balance",
          color: colors.background,
          backgroundColor: colors.foreground,
          boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.35)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Drawn in viewport space so it rides the camera, but shrunk as the camera
// zooms so it never dwarfs the UI.
export function Cursor({
  x,
  y,
  zoom,
  pressed,
}: {
  x: number;
  y: number;
  zoom: number;
  pressed: boolean;
}) {
  const size = 22 / Math.sqrt(zoom);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        position: "absolute",
        left: x - size * 0.17,
        top: y - size * 0.08,
        transform: `scale(${pressed ? 0.85 : 1})`,
        filter: "drop-shadow(0 1px 2px rgb(0 0 0 / .35))",
      }}
    >
      <path
        d="M4 2l16 10.5-7 1.5 4 7.5-3 1.5-4-7.5L4 20z"
        fill="#000"
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
