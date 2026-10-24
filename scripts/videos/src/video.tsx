import { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { palette } from "./brand";
import "./fonts";
import { buildSegments, pacedDuration } from "./pacing";
import { Scene } from "./scene";
import type { Timeline } from "./timeline";
import { Intro, Outro } from "./titles";
import type { Tutorial } from "./tutorials";

export const INTRO = 2.6;
export const OUTRO = 3.4;
// Intro → body and body → outro overlap by this much.
export const FADE = 0.6;

export type VideoProps = {
  // Folder under .recordings, e.g. "create-monitor" or "create-monitor.dark".
  recording: string;
  tutorial: Tutorial;
  timeline: Timeline | null;
};

export function totalSeconds(timeline: Timeline) {
  return INTRO + pacedDuration(buildSegments(timeline)) + OUTRO - 2 * FADE;
}

function Fade({
  frames,
  inAt,
  outAt,
  children,
}: {
  frames: number;
  inAt?: boolean;
  outAt?: boolean;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = FADE * fps;
  const opacity = Math.min(
    inAt
      ? interpolate(frame, [0, fade], [0, 1], { extrapolateRight: "clamp" })
      : 1,
    outAt
      ? interpolate(frame, [frames - fade, frames], [1, 0], {
          extrapolateLeft: "clamp",
        })
      : 1,
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function Video({ recording, tutorial, timeline }: VideoProps) {
  const { fps } = useVideoConfig();
  const segments = useMemo(
    () => (timeline ? buildSegments(timeline) : []),
    [timeline],
  );
  if (!timeline) return null;

  const theme = timeline.theme;
  const intro = Math.round(INTRO * fps);
  const fade = Math.round(FADE * fps);
  const body = Math.ceil(pacedDuration(segments) * fps);
  const outro = Math.round(OUTRO * fps);
  const bodyStart = intro - fade;
  const outroStart = bodyStart + body - fade;

  return (
    <AbsoluteFill style={{ backgroundColor: palette[theme].background }}>
      <Sequence durationInFrames={intro}>
        <Fade frames={intro} outAt>
          <Intro
            theme={theme}
            title={tutorial.title}
            subtitle={tutorial.subtitle}
          />
        </Fade>
      </Sequence>
      <Sequence from={bodyStart} durationInFrames={body}>
        <Fade frames={body} inAt outAt>
          <Scene
            recording={recording}
            timeline={timeline}
            segments={segments}
          />
        </Fade>
      </Sequence>
      <Sequence from={outroStart} durationInFrames={outro}>
        <Fade frames={outro} inAt>
          <Outro
            theme={theme}
            title={tutorial.outroTitle}
            subtitle={tutorial.outroSubtitle}
          />
        </Fade>
      </Sequence>
    </AbsoluteFill>
  );
}
