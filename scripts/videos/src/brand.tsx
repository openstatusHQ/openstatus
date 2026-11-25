import type { CSSProperties } from "react";

import { fonts } from "./fonts";

export type Theme = "light" | "dark";

// Neutral scale of the dashboard: background, the grey stage behind the
// window, muted copy, hairlines.
export const palette = {
  light: {
    background: "#ffffff",
    stage: "#f2f2f2",
    foreground: "#0a0a0a",
    muted: "#737373",
    border: "rgb(0 0 0 / 0.08)",
    shadow: "0 40px 100px -20px rgb(0 0 0 / 0.18)",
  },
  dark: {
    background: "#0a0a0a",
    stage: "#141414",
    foreground: "#fafafa",
    muted: "#a3a3a3",
    border: "rgb(255 255 255 / 0.1)",
    shadow: "0 40px 100px -20px rgb(0 0 0 / 0.7)",
  },
} satisfies Record<Theme, Record<string, string>>;

// The mark from apps/dashboard/src/app/icon.svg: a disc with two slits.
export function Mark({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 330 330" width={size} height={size}>
      <mask id="openstatus-slits">
        <circle cx="165" cy="165" r="165" fill="#fff" />
        <path d="M122 96h208v15H122zM0 219h208v15H0z" fill="#000" />
      </mask>
      <circle
        cx="165"
        cy="165"
        r="165"
        fill={color}
        mask="url(#openstatus-slits)"
      />
    </svg>
  );
}

export function Wordmark({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.28,
        color,
        ...style,
      }}
    >
      <Mark size={size} color={color} />
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: size * 0.82,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        openstatus
      </span>
    </div>
  );
}
