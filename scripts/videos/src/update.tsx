import { useMemo, type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Body, type Recording } from "./body";
import { Mark, palette } from "./brand";
import { fonts } from "./fonts";
import { CaptionLook } from "./scene";
import { updateOf, type Timeline } from "./timeline";
import { FEED, IRIS, isTall, updateSections } from "./update-layout";

// An update opens and ends on ink whatever the recording's theme, so a loop
// in a feed cuts from black to black.
const INK = "#0a0a0a";
const PAPER = "#fafafa";
const DIM = "#a3a3a3";
// The dashboard's status tokens.
const status = {
  success: "oklch(0.72 0.19 150)",
  warning: "oklch(0.77 0.16 70)",
  error: "oklch(0.64 0.22 27)",
  info: "oklch(0.62 0.19 260)",
};

const bouncy = { damping: 11, stiffness: 190, mass: 0.7 };

// 0 → 1 with an overshoot, starting `delay` seconds into the sequence.
function usePop(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay * fps, fps, config: bouncy });
}

function Sticker({
  delay,
  tilt,
  children,
}: {
  delay: number;
  tilt: number;
  children: ReactNode;
}) {
  const pop = usePop(delay);
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontWeight: 700,
        fontSize: 34,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "12px 26px",
        borderRadius: 9999,
        color: INK,
        backgroundColor: status.success,
        opacity: Math.min(1, pop * 3),
        transform: `scale(${pop}) rotate(${tilt - (1 - pop) * 24}deg)`,
      }}
    >
      {children}
    </div>
  );
}

// Each word lands a beat after the one before it.
function Words({
  text,
  delay,
  size,
}: {
  text: string;
  delay: number;
  size: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: size * 0.24,
        maxWidth: useMeasure(),
        fontFamily: fonts.display,
        fontSize: size,
        letterSpacing: "-0.035em",
        lineHeight: 1.05,
        color: PAPER,
      }}
    >
      {text.split(" ").map((word, i) => {
        const pop = spring({
          frame: frame - (delay + i * 0.09) * fps,
          fps,
          config: bouncy,
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: Math.min(1, pop * 2.5),
              transform: `translateY(${(1 - pop) * 60}px) scale(${0.7 + 0.3 * pop})`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

function Rise({ delay, children }: { delay: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame / fps - delay, [0, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: INK,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 34,
        textAlign: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// The widest a card's copy runs.
function useMeasure() {
  const frame = useVideoConfig();
  return isTall(frame) ? frame.width - 160 : 1560;
}

// Long feature names step down so they stay on two lines (three in 9:16),
// and further if the longest word would not fit a line: Cal Sans runs about
// 0.55em a letter.
function useTitleSize(title: string) {
  const measure = useMeasure();
  const step = title.length <= 16 ? 156 : title.length <= 28 ? 124 : 98;
  const longest = Math.max(...title.split(" ").map((word) => word.length));
  return Math.min(step, measure / (longest * 0.55));
}

function Hook({ title, tagline }: { title: string; tagline: string }) {
  const tall = isTall(useVideoConfig());
  return (
    <Card>
      <Sticker delay={0} tilt={-6}>
        New
      </Sticker>
      <Words text={title} delay={0.12} size={useTitleSize(title)} />
      <Rise delay={0.55}>
        <div
          style={{
            maxWidth: useMeasure(),
            fontFamily: fonts.sans,
            fontSize: tall ? 44 : 38,
            lineHeight: tall ? 1.3 : undefined,
            textWrap: "balance",
            color: DIM,
          }}
        >
          {tagline}
        </div>
      </Rise>
    </Card>
  );
}

function End({
  title,
  link,
  delay,
}: {
  title: string;
  link: string;
  delay: number;
}) {
  const url = `openstatus.dev/${link}`;
  // Commit Mono advances 0.6em a character, so a long link shrinks to fit.
  const size = Math.min(34, (useMeasure() - 50) / (url.length * 0.6));
  return (
    <Card>
      <Sticker delay={delay} tilt={5}>
        Out now
      </Sticker>
      <Words
        text={title}
        delay={delay + 0.1}
        size={useTitleSize(title) * 0.72}
      />
      <Rise delay={delay + 0.45}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 8,
            fontFamily: fonts.mono,
            fontSize: size,
            color: PAPER,
          }}
        >
          <Mark size={34} color={PAPER} />
          {url}
        </div>
      </Rise>
    </Card>
  );
}

// What the video is about, for whoever lands in the middle of a loop.
function Tag({ title, frames }: { title: string; frames: number }) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const { fps } = config;
  // In 9:16 it is a headline: larger, centred, under the feed's own header.
  const tall = isTall(config);
  const pop = usePop(IRIS);
  const out = interpolate(frame, [frames - IRIS * fps, frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: tall ? 0 : 32,
        right: tall ? 0 : undefined,
        top: tall ? FEED.top : 22,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 18px 8px 8px",
          borderRadius: 9999,
          backgroundColor: INK,
          color: PAPER,
          fontFamily: fonts.sans,
          fontWeight: 500,
          fontSize: 22,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.35)",
          opacity: Math.min(1, pop * 3) * out,
          transformOrigin: tall ? "50% 0" : "0 50%",
          transform: `scale(${pop * (tall ? 1.6 : 1)})`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "5px 12px",
            borderRadius: 9999,
            color: INK,
            backgroundColor: status.success,
          }}
        >
          New
        </span>
        {title}
      </div>
    </div>
  );
}

const PIECES = 160;
const GRAVITY = 2600;
const DRAG = 1.7;
const colors = [...Object.values(status), PAPER];

// Two cannons in the bottom corners, firing up and inwards. Every piece is a
// function of time alone, so any frame renders on its own.
function Confetti({ frames }: { frames: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const r = (k: string) => random(`confetti-${i}-${k}`);
        const left = i % 2 === 0;
        const angle = ((52 + r("angle") * 34) * Math.PI) / 180;
        const speed = 1500 + r("speed") * 1900;
        // Tuned on 1920×1080; another frame is crossed in the same time.
        return {
          x: left ? -20 : width + 20,
          y: height + 20,
          vx: Math.cos(angle) * speed * (left ? 1 : -1) * (width / 1920),
          vy: -Math.sin(angle) * speed * (height / 1080),
          delay: r("delay") * 0.18,
          size: 12 + r("size") * 14,
          round: r("shape") < 0.25,
          color: colors[Math.floor(r("color") * colors.length)],
          spin: (r("spin") - 0.5) * 900,
          flip: 5 + r("flip") * 9,
          phase: r("phase") * Math.PI * 2,
        };
      }),
    [width, height],
  );
  const fade = interpolate(frame, [frames - 0.5 * fps, frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {pieces.map((p, i) => {
        const age = t - p.delay;
        if (age <= 0) return null;
        // Velocity decays under drag; gravity pulls towards terminal speed.
        const glide = (1 - Math.exp(-DRAG * age)) / DRAG;
        const x = p.x + p.vx * glide;
        const y =
          p.y +
          p.vy * glide +
          (GRAVITY * (height / 1080) * (age - glide)) / DRAG;
        if (y > height + 60) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              borderRadius: p.round ? 9999 : 2,
              backgroundColor: p.color,
              transform: `rotate(${p.spin * age}deg) scaleY(${Math.cos(age * p.flip + p.phase)})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

const sweep = Easing.inOut(Easing.cubic);

// The recording through a circle that opens at its start and closes at its
// end, settling from slightly too close as it opens.
function Iris({
  frames,
  backdrop,
  children,
}: {
  frames: number;
  backdrop: string;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const iris = IRIS * fps;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const open = interpolate(frame, [0, iris], [0, 1], clamp);
  const close = interpolate(frame, [frames - iris, frames], [0, 1], clamp);
  const radius =
    (Math.hypot(width, height) / 2 + 2) * sweep(open) * (1 - sweep(close));
  const settle = interpolate(frame, [0, iris * 1.6], [1.07, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        // Parts cross-fade over this, not over the ink behind the circle.
        backgroundColor: backdrop,
        clipPath: `circle(${radius}px at 50% 50%)`,
        transform: `scale(${settle})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function Update({
  timeline,
  clips,
  ...rest
}: Recording & { clips: Record<string, Timeline> }) {
  const { fps } = useVideoConfig();
  const { hook, body, end, bodyStart, endStart, parts } = useMemo(
    () => updateSections(timeline, clips, fps),
    [timeline, clips, fps],
  );
  const update = updateOf(timeline);
  if (!update) return null;
  // The end card waits under the closing iris; its copy starts as it shuts.
  const shut = IRIS * 0.7;

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence durationInFrames={hook}>
        <Hook title={update.title} tagline={update.tagline} />
      </Sequence>
      <Sequence from={endStart} durationInFrames={end}>
        <End
          title={update.title}
          link={update.link ?? "changelog"}
          delay={shut}
        />
      </Sequence>
      <Sequence from={bodyStart} durationInFrames={body}>
        <Iris frames={body} backdrop={palette[timeline.theme].stage}>
          <CaptionLook.Provider value="update">
            <Body timeline={timeline} parts={parts} {...rest} />
          </CaptionLook.Provider>
          <Tag title={update.title} frames={body} />
        </Iris>
      </Sequence>
      <Sequence
        from={endStart + Math.round(shut * fps)}
        durationInFrames={end - Math.round(shut * fps)}
      >
        <Confetti frames={end - Math.round(shut * fps)} />
      </Sequence>
    </AbsoluteFill>
  );
}
