import { Composition, Still, getStaticFiles, staticFile } from "remotion";

import { recordingsFrom, thumbnailsFrom } from "./recordings";
import type { SlackData } from "./slack-data";
import type { TerminalData } from "./terminal-data";
import { Thumbnail, type ThumbnailProps } from "./thumbnail";
import type { Timeline } from "./timeline";
import { Video, totalFrames, type VideoProps } from "./video";

const json = async <T,>(path: string) =>
  (await (await fetch(staticFile(path))).json()) as T;

// A recording's timeline, plus what terminal and Slack recordings draw from.
async function load(recording: string) {
  const timeline = await json<Timeline>(`${recording}/timeline.json`);
  const terminal =
    timeline.kind === "terminal"
      ? await json<TerminalData>(`${recording}/terminal.json`)
      : null;
  const slack =
    timeline.kind === "slack"
      ? await json<SlackData>(`${recording}/slack.json`)
      : null;
  const clips: Record<string, Timeline> = Object.fromEntries(
    await Promise.all(
      (timeline.inserts ?? []).map(
        async ({ clip }) =>
          [
            clip,
            await json<Timeline>(`${recording}/${clip}/timeline.json`),
          ] as const,
      ),
    ),
  );
  return { timeline, terminal, slack, clips };
}

// One composition per recording (node scripts/record.mjs <id> --remotion, or
// node scripts/record-terminal.mjs <id>), and a <id>-thumbnail still for
// each that has a thumbnail.png, a terminal.json or a slack.json.
export function RemotionRoot() {
  const files = getStaticFiles();
  return (
    <>
      {recordingsFrom(files).map((recording) => (
        <Composition
          key={recording}
          id={recording}
          component={Video}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={1}
          defaultProps={
            {
              recording,
              timeline: null,
              terminal: null,
              slack: null,
              clips: {},
            } satisfies VideoProps
          }
          calculateMetadata={async ({ props }) => {
            const loaded = await load(props.recording);
            return {
              fps: loaded.timeline.fps,
              durationInFrames: totalFrames(
                loaded.timeline,
                loaded.clips,
                loaded.timeline.fps,
              ),
              props: { ...props, ...loaded },
            };
          }}
        />
      ))}
      {thumbnailsFrom(files).map((recording) => (
        <Still
          key={`${recording}-thumbnail`}
          id={`${recording}-thumbnail`}
          component={Thumbnail}
          width={1920}
          height={1080}
          defaultProps={
            {
              recording,
              timeline: null,
              terminal: null,
              slack: null,
            } satisfies ThumbnailProps
          }
          calculateMetadata={async ({ props }) => ({
            props: { ...props, ...(await load(props.recording)) },
          })}
        />
      ))}
    </>
  );
}
