import { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { buildShots, cameraAt, cursorAt } from "./camera";
import { eventsOf, type Timeline } from "./timeline";

export type WalkthroughProps = {
  // Folder under .recordings, e.g. "create-monitor" or "create-monitor.dark".
  recording: string;
  timeline: Timeline | null;
};

const RIPPLE = 0.5;

export function Walkthrough({ recording, timeline }: WalkthroughProps) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const shots = useMemo(
    () => (timeline ? buildShots(timeline) : []),
    [timeline],
  );
  if (!timeline) return null;

  const t = frame / fps;
  const { width: vw, height: vh } = timeline.viewport;
  const camera = cameraAt(shots, t, timeline);
  const scale = (width / vw) * camera.zoom;
  const [cx, cy] = cursorAt(timeline, t);
  const ripples = eventsOf(timeline, "click").filter(
    (c) => t >= c.t && t < c.t + RIPPLE,
  );

  return (
    <AbsoluteFill
      style={{ backgroundColor: timeline.theme === "dark" ? "#000" : "#fff" }}
    >
      <div
        style={{
          position: "absolute",
          width: vw,
          height: vh,
          transformOrigin: "0 0",
          transform: `translate(${width / 2}px, ${(width * vh) / vw / 2}px) scale(${scale}) translate(${-camera.x}px, ${-camera.y}px)`,
        }}
      >
        <OffthreadVideo
          src={staticFile(`${recording}/video.mp4`)}
          style={{ width: vw, height: vh }}
        />
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
        <Cursor x={cx} y={cy} zoom={camera.zoom} pressed={ripples.length > 0} />
      </div>
    </AbsoluteFill>
  );
}

// Drawn in viewport space so it rides the camera, but shrunk as the camera
// zooms so it never dwarfs the UI.
function Cursor({
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
