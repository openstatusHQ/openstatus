import { Composition, staticFile } from "remotion";

import type { Timeline } from "./timeline";
import { tutorials } from "./tutorials";
import { Video, totalSeconds, type VideoProps } from "./video";

// Record first: node scripts/record.mjs <id> --remotion [--theme dark]
export function RemotionRoot() {
  return (
    <>
      {tutorials.flatMap((tutorial) =>
        (["light", "dark"] as const).map((theme) => (
          <Composition
            key={`${tutorial.id}-${theme}`}
            id={theme === "dark" ? `${tutorial.id}-dark` : tutorial.id}
            component={Video}
            width={1920}
            height={1080}
            fps={30}
            durationInFrames={1}
            defaultProps={
              {
                recording:
                  theme === "dark" ? `${tutorial.id}.dark` : tutorial.id,
                tutorial,
                timeline: null,
              } satisfies VideoProps
            }
            calculateMetadata={async ({ props }) => {
              const res = await fetch(
                staticFile(`${props.recording}/timeline.json`),
              );
              const timeline = (await res.json()) as Timeline;
              return {
                fps: timeline.fps,
                durationInFrames: Math.ceil(
                  totalSeconds(timeline) * timeline.fps,
                ),
                props: { ...props, timeline },
              };
            }}
          />
        )),
      )}
    </>
  );
}
