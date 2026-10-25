import { Composition, Still, getStaticFiles, staticFile } from "remotion";

import { recordingsFrom, thumbnailsFrom } from "./recordings";
import type { TerminalData } from "./terminal-data";
import { Thumbnail, type ThumbnailProps } from "./thumbnail";
import type { Timeline } from "./timeline";
import { Video, totalFrames, type VideoProps } from "./video";

const json = async <T,>(path: string) =>
  (await (await fetch(staticFile(path))).json()) as T;

// A recording's timeline, plus its screens when it is a terminal recording.
async function load(recording: string) {
  const timeline = await json<Timeline>(`${recording}/timeline.json`);
  const terminal =
    timeline.kind === "terminal"
      ? await json<TerminalData>(`${recording}/terminal.json`)
      : null;
  return { timeline, terminal };
}

// One composition per recording (node scripts/record.mjs <id> --remotion, or
// node scripts/record-terminal.mjs <id>), and a <id>-thumbnail still for
// each that has a thumbnail.png or a terminal.json.
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
            { recording, timeline: null, terminal: null } satisfies VideoProps
          }
          calculateMetadata={async ({ props }) => {
            const { timeline, terminal } = await load(props.recording);
            return {
              fps: timeline.fps,
              durationInFrames: totalFrames(timeline, timeline.fps),
              props: { ...props, timeline, terminal },
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
