import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Mark, Wordmark, palette, type Theme } from "./brand";
import { fonts } from "./fonts";

// Each line rises into place a beat after the one before it.
function Reveal({ delay, children }: { delay: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame / fps - delay, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      {children}
    </div>
  );
}

function Card({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette[theme].background,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
        textAlign: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function Title({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 100,
        letterSpacing: "-0.035em",
        lineHeight: 1.05,
        color: palette[theme].foreground,
      }}
    >
      {children}
    </div>
  );
}

function Subtitle({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.sans,
        fontSize: 30,
        color: palette[theme].muted,
        marginTop: -6,
      }}
    >
      {children}
    </div>
  );
}

export function Intro({
  theme,
  title,
  subtitle,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
}) {
  return (
    <Card theme={theme}>
      <Reveal delay={0}>
        <Wordmark size={56} color={palette[theme].foreground} />
      </Reveal>
      <Reveal delay={0.25}>
        <Title theme={theme}>{title}</Title>
      </Reveal>
      <Reveal delay={0.45}>
        <Subtitle theme={theme}>{subtitle}</Subtitle>
      </Reveal>
    </Card>
  );
}

export function Outro({
  theme,
  title,
  subtitle,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
}) {
  const colors = palette[theme];
  return (
    <Card theme={theme}>
      <Reveal delay={0.1}>
        <Title theme={theme}>{title}</Title>
      </Reveal>
      <Reveal delay={0.3}>
        <Subtitle theme={theme}>{subtitle}</Subtitle>
      </Reveal>
      <Reveal delay={0.5}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 16,
            fontFamily: fonts.mono,
            fontSize: 30,
            color: colors.foreground,
          }}
        >
          <Mark size={30} color={colors.foreground} />
          openstatus.dev
        </div>
      </Reveal>
    </Card>
  );
}
