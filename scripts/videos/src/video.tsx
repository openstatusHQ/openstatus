import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import type { AgentData } from "./agent-data";
import { Body, Fade } from "./body";
import { palette } from "./brand";
import "./fonts";
import { copyOf } from "./recordings";
import type { SlackData } from "./slack-data";
import { FADE, layoutParts, partsOf } from "./story";
import type { TerminalData } from "./terminal-data";
import { isUpdate, type Timeline } from "./timeline";
import { Intro, Outro } from "./titles";
import { Update } from "./update";
import { updateSections } from "./update-layout";

export const INTRO = 2.6;
export const OUTRO = 3.4;

export type VideoProps = {
  // Folder under .recordings, e.g. "create-monitor".
  recording: string;
  timeline: Timeline | null;
  // terminal.json, slack.json and agent.json, for those recordings.
  terminal: TerminalData | null;
  slack: SlackData | null;
  agent: AgentData | null;
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
) =>
  (isUpdate(timeline) ? updateSections : sections)(timeline, clips, fps).total;

export function Video({ timeline, clips, ...rest }: VideoProps) {
  if (!timeline) return null;
  return isUpdate(timeline) ? (
    <Update timeline={timeline} clips={clips} {...rest} />
  ) : (
    <Tutorial timeline={timeline} clips={clips} {...rest} />
  );
}

function Tutorial({
  timeline,
  clips,
  ...rest
}: VideoProps & { timeline: Timeline }) {
  const { fps } = useVideoConfig();
  const { intro, body, outro, bodyStart, outroStart, parts } = useMemo(
    () => sections(timeline, clips, fps),
    [timeline, clips, fps],
  );
  const theme = timeline.theme;
  const tutorial = copyOf(timeline);

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
          <Body timeline={timeline} parts={parts} {...rest} />
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
