import { describe, expect, it } from "bun:test";
import { isSvgFile, sanitizeSvg } from "./blob";

describe("isSvgFile", () => {
  it("detects .svg extension", () => {
    expect(isSvgFile("logo.svg")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSvgFile("logo.SVG")).toBe(true);
    expect(isSvgFile("logo.Svg")).toBe(true);
  });

  it("rejects non-svg extensions", () => {
    expect(isSvgFile("logo.png")).toBe(false);
    expect(isSvgFile("logo.ico")).toBe(false);
    expect(isSvgFile("logo.svg.png")).toBe(false);
  });
});

describe("sanitizeSvg", () => {
  it("keeps valid SVG content", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).toContain("<circle");
    expect(result).toContain("<svg");
  });

  it("strips <script> tags", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><circle cx="50" cy="50" r="40"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<circle");
  });

  it("strips onclick attributes", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" onclick="alert(1)"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("onclick");
    expect(result).toContain("<circle");
  });

  it("strips onload attributes", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="100" height="100"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("onload");
    expect(result).toContain("<rect");
  });

  it("strips onerror attributes", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image onerror="alert(1)"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("onerror");
  });

  it("strips onmouseover and onfocus attributes", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" onmouseover="alert(1)" onfocus="alert(2)"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("onmouseover");
    expect(result).not.toContain("onfocus");
    expect(result).toContain("<rect");
  });

  it("strips onanimationend and ontouchstart attributes", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" onanimationend="alert(1)" ontouchstart="alert(2)"/></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("onanimationend");
    expect(result).not.toContain("ontouchstart");
    expect(result).toContain("<circle");
  });

  it("strips foreignObject tags", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("<script");
  });

  it("strips javascript: protocol in href", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle cx="50" cy="50" r="40"/></a></svg>';
    const result = await sanitizeSvg(svg);
    expect(result).not.toContain("javascript");
  });

  it("returns empty string for fully malicious SVG", async () => {
    const svg = '<script>alert("xss")</script>';
    const result = await sanitizeSvg(svg);
    expect(result.trim()).toBe("");
  });

  it("preserves common SVG elements", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad">
          <stop offset="0%" stop-color="red"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <g>
        <path d="M10 10 H 90 V 90 H 10 Z"/>
        <rect width="50" height="50" fill="url(#grad)"/>
        <circle cx="25" cy="25" r="10"/>
        <ellipse cx="50" cy="50" rx="30" ry="20"/>
        <line x1="0" y1="0" x2="100" y2="100"/>
        <polyline points="0,0 50,50 100,0"/>
        <polygon points="50,0 100,100 0,100"/>
        <text x="10" y="20">Hello</text>
      </g>
    </svg>`;
    const result = await sanitizeSvg(svg);
    for (const tag of [
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "text",
      "g",
      "defs",
      "linearGradient",
      "stop",
    ]) {
      expect(result).toContain(`<${tag}`);
    }
  });
});
