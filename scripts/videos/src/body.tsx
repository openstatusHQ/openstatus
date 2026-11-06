import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { AgentScene } from "./agent";
import type { AgentData } from "./agent-data";
import type { Segment } from "./pacing";
import { Scene } from "./scene";
import { SlackScene } from "./slack";
import type { SlackData } from "./slack-data";
import { FADE, type layoutParts } from "./story";
import { TerminalScene } from "./terminal";
import type { TerminalData } from "./terminal-data";
import type { Timeline } from "./timeline";

export type Recording = {
  // Folder under .recordings, e.g. "create-monitor".
  recording: string;
  timeline: Timeline;
  // terminal.json, slack.json and agent.json, for those recordings.
  terminal: TerminalData | null;
  slack: SlackData | null;
  agent: AgentData | null;
};

export function Fade({
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

// The recording itself, between whatever opens and closes the video. Parts
// cross-fade into each other; most bodies are one part.
export function Body({
  recording,
  timeline,
  terminal,
  slack,
  agent,
  parts,
}: Recording & { parts: ReturnType<typeof layoutParts>["placed"] }) {
  const main = (segments: Segment[]) =>
    timeline.kind === "slack" && slack ? (
      <SlackScene timeline={timeline} slack={slack} segments={segments} />
    ) : timeline.kind === "agent" && agent ? (
      <AgentScene timeline={timeline} agent={agent} segments={segments} />
    ) : timeline.kind === "terminal" && terminal ? (
      <TerminalScene
        timeline={timeline}
        terminal={terminal}
        segments={segments}
      />
    ) : (
      <Scene recording={recording} timeline={timeline} segments={segments} />
    );

  return parts.map(({ part, from, frames }, i) => (
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
  ));
}
