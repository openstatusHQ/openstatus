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
import type { Segment } from "./pacing";
import { copyOf } from "./recordings";
import { Scene } from "./scene";
import { SlackScene } from "./slack";
import type { SlackData } from "./slack-data";
import { layoutParts, partsOf } from "./story";
import { TerminalScene } from "./terminal";
import type { TerminalData } from "./terminal-data";
import type { Timeline } from "./timeline";
import { Intro, Outro } from "./titles";

export const INTRO = 2.6;
export const OUTRO = 3.4;
// Intro → body and body → outro overlap by this much.
export const FADE = 0.6;

export type VideoProps = {
  // Folder under .recordings, e.g. "create-monitor".
  recording: string;
  timeline: Timeline | null;
  // terminal.json and slack.json, for those recordings.
  terminal: TerminalData | null;
  slack: SlackData | null;
  // Timelines of the dashboard clips cut into a Slack recording, by folder.
  clips: Record<string, Timeline>;
};

// Section lengths in whole frames: the composition length and the sequences
// inside it come from this one place, so they cannot drift apart.
export function sections(
  timeline: Timeline,
  clips: Record<string, Timeline>,
  fps: number,
) {
  const intro = Math.round(INTRO * fps);
  const fade = Math.round(FADE * fps);
  const parts = layoutParts(partsOf(timeline, clips), fps, fade);
  const body = parts.frames;
  const outro = Math.round(OUTRO * fps);
  const bodyStart = intro - fade;
  const outroStart = bodyStart + body - fade;
  return {
    intro,
    fade,
    body,
    outro,
    bodyStart,
    outroStart,
    parts: parts.placed,
    total: outroStart + outro,
  };
}

export const totalFrames = (
  timeline: Timeline,
  clips: Record<string, Timeline>,
  fps: number,
) => sections(timeline, clips, fps).total;

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

export function Video({
  recording,
  timeline,
  terminal,
  slack,
  clips,
}: VideoProps) {
  const { fps } = useVideoConfig();
  const layout = useMemo(
    () => (timeline ? sections(timeline, clips, fps) : null),
    [timeline, clips, fps],
  );
  if (!timeline || !layout) return null;

  const theme = timeline.theme;
  const tutorial = copyOf(timeline);
  const { intro, body, outro, bodyStart, outroStart, parts } = layout;
  const main = (segments: Segment[]) =>
    timeline.kind === "slack" && slack ? (
      <SlackScene timeline={timeline} slack={slack} segments={segments} />
    ) : timeline.kind === "terminal" && terminal ? (
      <TerminalScene
        timeline={timeline}
        terminal={terminal}
        segments={segments}
      />
    ) : (
      <Scene recording={recording} timeline={timeline} segments={segments} />
    );

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
          {/* Parts cross-fade into each other; most bodies are one part. */}
          {parts.map(({ part, from, frames }, i) => (
            <Sequence key={i} from={from} durationInFrames={frames}>
              <Fade frames={frames} inAt={i > 0} outAt={i < parts.length - 1}>
                {part.kind === "main" ? (
                  main(part.segments)
                ) : (
                  <Scene
                    recording={`${recording}/${part.clip}`}
                    timeline={part.timeline}
                    segments={part.segments}
                  />
                )}
              </Fade>
            </Sequence>
          ))}
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
