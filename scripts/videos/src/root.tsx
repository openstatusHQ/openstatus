import { Composition, Still, getStaticFiles, staticFile } from "remotion";

import { recordingsFrom, thumbnailsFrom } from "./recordings";
import { Thumbnail, type ThumbnailProps } from "./thumbnail";
import type { Timeline } from "./timeline";
import { Video, totalFrames, type VideoProps } from "./video";

const timelineOf = async (recording: string) =>
  (await (
    await fetch(staticFile(`${recording}/timeline.json`))
  ).json()) as Timeline;

// One composition per recording (node scripts/record.mjs <id> --remotion),
// and a <id>-thumbnail still for each that has a thumbnail.png.
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
          defaultProps={{ recording, timeline: null } satisfies VideoProps}
          calculateMetadata={async ({ props }) => {
            const timeline = await timelineOf(props.recording);
            return {
              fps: timeline.fps,
              durationInFrames: totalFrames(timeline, timeline.fps),
              props: { ...props, timeline },
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
          defaultProps={{ recording, timeline: null } satisfies ThumbnailProps}
          calculateMetadata={async ({ props }) => ({
            props: { ...props, timeline: await timelineOf(props.recording) },
          })}
        />
      ))}
    </>
  );
}
