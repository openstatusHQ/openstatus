// What scripts/record-terminal.mjs writes to terminal.json: the visible screen
// after every change, as rows of [text, style] runs. Times are seconds.
export type TerminalStyle = {
  // "p<n>" for palette colors, "#rrggbb" for true color, null for default.
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
};

export type TerminalFrame = {
  t: number;
  lines: [text: string, style: number][][];
  cursor: [x: number, y: number] | null;
};

export type TerminalData = {
  cols: number;
  rows: number;
  styles: TerminalStyle[];
  frames: TerminalFrame[];
};

// The screen showing at `t`: the last frame drawn at or before it.
export function frameAt(data: TerminalData, t: number): TerminalFrame {
  const { frames } = data;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

// A light terminal theme: "white" is a mid gray so it reads on white, the
// way light themes draw it.
const ANSI_LIGHT = [
  "#24292f",
  "#cf222e",
  "#116329",
  "#9a6700",
  "#0969da",
  "#8250df",
  "#1b7c83",
  "#6e7781",
  "#57606a",
  "#a40e26",
  "#1a7f37",
  "#7d4e00",
  "#218bff",
  "#a475f9",
  "#3192aa",
  "#8c959f",
];

const hex = (n: number) => n.toString(16).padStart(2, "0");

// xterm's 256 colors: the 16 above, a 6×6×6 cube, then 24 grays.
export function paletteColor(index: number): string {
  if (index < 16) return ANSI_LIGHT[index];
  if (index < 232) {
    const levels = [0, 95, 135, 175, 215, 255];
    const i = index - 16;
    const [r, g, b] = [Math.floor(i / 36), Math.floor(i / 6) % 6, i % 6];
    return `#${hex(levels[r])}${hex(levels[g])}${hex(levels[b])}`;
  }
  const v = 8 + (index - 232) * 10;
  return `#${hex(v)}${hex(v)}${hex(v)}`;
}

export function resolveColor(color: string | null): string | null {
  if (color === null) return null;
  if (color.startsWith("p")) return paletteColor(Number(color.slice(1)));
  return color;
}
