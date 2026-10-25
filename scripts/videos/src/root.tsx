import { Composition, getStaticFiles, staticFile } from "remotion";

import { recordingsFrom } from "./recordings";
import type { Timeline } from "./timeline";
import { Video, totalFrames, type VideoProps } from "./video";

// One composition per recording: node scripts/record.mjs <id> --remotion.
export function RemotionRoot() {
  return (
    <>
      {recordingsFrom(getStaticFiles()).map((recording) => (
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
            const res = await fetch(
              staticFile(`${props.recording}/timeline.json`),
            );
            const timeline = (await res.json()) as Timeline;
            return {
              fps: timeline.fps,
              durationInFrames: totalFrames(timeline, timeline.fps),
              props: { ...props, timeline },
            };
          }}
        />
      ))}
    </>
  );
}
