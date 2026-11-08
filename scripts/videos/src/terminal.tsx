import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { palette } from "./brand";
import { stepAt } from "./camera";
import { fonts } from "./fonts";
import { sourceTime, type Segment } from "./pacing";
import { Caption, CAPTION_FADE } from "./scene";
import {
  frameAt,
  resolveColor,
  type TerminalData,
  type TerminalFrame,
  type TerminalStyle,
} from "./terminal-data";
import type { Timeline } from "./timeline";

// Commit Mono advances 0.6em per cell; lines get some air.
const ADVANCE = 0.6;
const LINE = 1.4;
const BAR = 46;

// The window's size for a font size, so callers can fit it to a box.
export function terminalSize(data: TerminalData, fontSize: number) {
  const pad = fontSize * 1.2;
  return {
    width: data.cols * fontSize * ADVANCE + pad * 2,
    height: data.rows * fontSize * LINE + pad * 2 + BAR,
  };
}

function runStyle(style: TerminalStyle): CSSProperties {
  const colors = palette.light;
  let fg = resolveColor(style.fg) ?? colors.foreground;
  let bg = resolveColor(style.bg);
  if (style.inverse) [fg, bg] = [bg ?? colors.background, fg];
  return {
    color: fg,
    backgroundColor: bg ?? undefined,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    opacity: style.dim ? 0.6 : undefined,
  };
}

// A terminal window drawn from one recorded screen.
export function TerminalWindow({
  data,
  frame,
  fontSize,
  title = "acme — openstatus",
  style,
}: {
  data: TerminalData;
  frame: TerminalFrame;
  fontSize: number;
  title?: string;
  style?: CSSProperties;
}) {
  const colors = palette.light;
  const { width, height } = terminalSize(data, fontSize);
  const pad = fontSize * 1.2;
  const cell = fontSize * ADVANCE;
  const line = fontSize * LINE;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: colors.background,
        boxShadow: `0 0 0 1px ${colors.border}, ${colors.shadow}`,
        ...style,
      }}
    >
      <div
        style={{
          height: BAR,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 18px",
          borderBottom: `1px solid ${colors.border}`,
          position: "relative",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div
            key={c}
            style={{
              width: 13,
              height: 13,
              borderRadius: 9999,
              backgroundColor: c,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.sans,
            fontSize: 17,
            color: colors.muted,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          padding: pad,
          fontFamily: fonts.mono,
          fontSize,
          lineHeight: `${line}px`,
          fontVariantLigatures: "none",
          whiteSpace: "pre",
        }}
      >
        {frame.lines.map((runs, y) => (
          <div key={y} style={{ height: line }}>
            {runs.map(([text, s], i) => (
              <span key={i} style={runStyle(data.styles[s])}>
                {text}
              </span>
            ))}
          </div>
        ))}
        {frame.cursor && (
          <div
            style={{
              position: "absolute",
              left: pad + frame.cursor[0] * cell,
              top: pad + frame.cursor[1] * line + (line - fontSize * 1.25) / 2,
              width: cell,
              height: fontSize * 1.25,
              backgroundColor: colors.foreground,
              opacity: 0.75,
            }}
          />
        )}
      </div>
    </div>
  );
}

// The recorded session in a window on the stage, paced like the browser
// recordings, with the same captions.
export function TerminalScene({
  timeline,
  terminal,
  segments,
}: {
  timeline: Timeline;
  terminal: TerminalData;
  segments: Segment[];
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colors = palette.light;
  const t = sourceTime(segments, frame / fps);

  // As large as fits 88% of the width and 82% of the height.
  const unit = terminalSize(terminal, 1);
  const base = terminalSize(terminal, 0);
  const fontSize = Math.min(
    (width * 0.88 - base.width) / (unit.width - base.width),
    (height * 0.82 - base.height) / (unit.height - base.height),
  );
  const size = terminalSize(terminal, fontSize);
  const step = stepAt(timeline, t);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage }}>
      <TerminalWindow
        data={terminal}
        frame={frameAt(terminal, t)}
        fontSize={fontSize}
        style={{
          position: "absolute",
          left: (width - size.width) / 2,
          top: (height - size.height) / 2 - 24,
        }}
      />
      {step && (
        <Caption
          key={step.t}
          label={step.label}
          opacity={interpolate(t - step.t, [0, CAPTION_FADE], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          theme="light"
        />
      )}
    </AbsoluteFill>
  );
}
