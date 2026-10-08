import type * as React from "react";

export type Tone = "danger" | "warning" | "info" | "success" | "neutral";

export const fonts = {
  sans: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
  mono: 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace',
};

export const colors = {
  page: "#f4f4f4",
  card: "#ffffff",
  border: "#e5e5e5",
  subtle: "#fafafa",
  foreground: "#171717",
  body: "#3f3f46",
  muted: "#525252",
  // 4.5:1 on both the card and the page background
  faint: "#6e6e6e",
};

// The only colour axis: pill, breached value, status dot.
export const tones = {
  danger: { text: "#b42318", bg: "#fdf1f0", border: "#f6d5d2", dot: "#e5484d" },
  warning: {
    text: "#a0460a",
    bg: "#fffaeb",
    border: "#f5dfa0",
    dot: "#f08c2e",
  },
  info: { text: "#1d4ed8", bg: "#eff6ff", border: "#cfe0fb", dot: "#3b82f6" },
  success: {
    text: "#1f6b3a",
    bg: "#f3fbf5",
    border: "#cfe9d8",
    dot: "#46a758",
  },
  neutral: {
    text: "#3f3f46",
    bg: "#f4f4f4",
    border: "#e0e0e0",
    dot: "#a3a3a3",
  },
} satisfies Record<Tone, Record<string, string>>;

export const styles = {
  main: {
    backgroundColor: colors.page,
    color: colors.foreground,
    fontFamily: fonts.sans,
    margin: 0,
    padding: "32px 12px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
  },
  card: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
  },
  header: {
    padding: "20px 28px",
    borderBottom: `1px solid ${colors.border}`,
  },
  content: {
    padding: "32px 28px 28px",
  },
  text: {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: "24px",
    color: colors.body,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: "0.94em",
    letterSpacing: "-0.01em",
  },
  label: {
    margin: "0 0 12px",
    fontFamily: fonts.mono,
    fontSize: "12px",
    lineHeight: "16px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: colors.faint,
  },
  link: {
    color: colors.body,
    textDecoration: "underline",
  },
} satisfies Record<string, React.CSSProperties>;
