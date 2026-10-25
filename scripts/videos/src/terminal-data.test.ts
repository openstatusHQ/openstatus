import { describe, expect, test } from "vitest";

import {
  frameAt,
  paletteColor,
  resolveColor,
  type TerminalData,
} from "./terminal-data";

const data: TerminalData = {
  cols: 10,
  rows: 1,
  styles: [],
  frames: [0, 0.5, 2].map((t) => ({ t, lines: [], cursor: null })),
};

describe("frameAt", () => {
  test("shows the last frame drawn at or before t", () => {
    expect(frameAt(data, 0.49).t).toBe(0);
    expect(frameAt(data, 0.5).t).toBe(0.5);
    expect(frameAt(data, 1.9).t).toBe(0.5);
  });

  test("holds the first and last frames outside the recording", () => {
    expect(frameAt(data, -1).t).toBe(0);
    expect(frameAt(data, 99).t).toBe(2);
  });
});

describe("colors", () => {
  test("draws the 16 ANSI colors from the light theme", () => {
    expect(paletteColor(1)).toBe("#cf222e");
    // "White" must stay readable on a white terminal.
    expect(paletteColor(7)).not.toBe("#ffffff");
  });

  test("follows xterm's 256-color cube and gray ramp", () => {
    expect(paletteColor(16)).toBe("#000000");
    expect(paletteColor(196)).toBe("#ff0000");
    expect(paletteColor(231)).toBe("#ffffff");
    expect(paletteColor(232)).toBe("#080808");
    expect(paletteColor(255)).toBe("#eeeeee");
  });

  test("resolves palette, true color and default", () => {
    expect(resolveColor("p4")).toBe("#0969da");
    expect(resolveColor("#123456")).toBe("#123456");
    expect(resolveColor(null)).toBeNull();
  });
});
