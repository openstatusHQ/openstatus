/** @jsxRuntime automatic @jsxImportSource react */

import { fonts, type Tone, tones } from "./styles";

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: string;
}) {
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 12px",
        border: `1px solid ${t.border}`,
        borderRadius: "999px",
        backgroundColor: t.bg,
        color: t.text,
        fontFamily: fonts.mono,
        fontSize: "11px",
        lineHeight: "14px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children.toUpperCase()}
    </span>
  );
}
