import { Composition, staticFile } from "remotion";

import type { Timeline } from "./timeline";
import { Walkthrough, type WalkthroughProps } from "./walkthrough";

// Record first: node scripts/record.mjs <name> --remotion [--theme dark]
const TUTORIALS = [
  "create-status-page",
  "create-monitor",
  "connect-monitors",
  "post-status-report",
  "schedule-maintenance",
  "set-up-alerts",
];

export function RemotionRoot() {
  return (
    <>
      {TUTORIALS.flatMap((name) =>
        (["light", "dark"] as const).map((theme) => (
          <Composition
            key={`${name}-${theme}`}
            id={theme === "dark" ? `${name}-dark` : name}
            component={Walkthrough}
            width={1920}
            height={1200}
            fps={30}
            durationInFrames={1}
            defaultProps={{
              recording: theme === "dark" ? `${name}.dark` : name,
              timeline: null,
            }}
            calculateMetadata={async ({ props }) => {
              const res = await fetch(
                staticFile(`${props.recording}/timeline.json`),
              );
              const timeline = (await res.json()) as Timeline;
              return {
                fps: timeline.fps,
                durationInFrames: Math.ceil(timeline.duration * timeline.fps),
                props: { ...props, timeline } satisfies WalkthroughProps,
              };
            }}
          />
        )),
      )}
    </>
  );
}
