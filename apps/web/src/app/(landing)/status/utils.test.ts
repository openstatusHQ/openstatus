import { describe, expect, test } from "vitest";

import { getCheckerHref, getComponentFullName, getHost } from "./utils";

describe("getComponentFullName", () => {
  test("does not repeat the provider already in the component name", () => {
    expect(getComponentFullName("Zoom", "Zoom AI")).toBe("Zoom AI");
  });

  test("prefixes the provider when the component name lacks it", () => {
    expect(getComponentFullName("Zoom", "Web SDK")).toBe("Zoom Web SDK");
  });

  test("matches the provider prefix case-insensitively", () => {
    expect(getComponentFullName("Zoom", "zoom Chat")).toBe("zoom Chat");
  });

  test("component equal to the provider name", () => {
    expect(getComponentFullName("Zoom", "Zoom")).toBe("Zoom");
  });

  test("requires a word boundary after the provider name", () => {
    expect(getComponentFullName("Zoom", "Zoomify")).toBe("Zoom Zoomify");
  });

  test("keeps the provider name when it appears later", () => {
    expect(getComponentFullName("Zoom", "Rooms for Zoom")).toBe(
      "Zoom Rooms for Zoom",
    );
  });

  test("trims surrounding whitespace", () => {
    expect(getComponentFullName("  Zoom ", " Zoom AI  ")).toBe("Zoom AI");
    expect(getComponentFullName(" Zoom", "Web SDK ")).toBe("Zoom Web SDK");
  });

  test("collapses inner whitespace runs", () => {
    expect(getComponentFullName("Zoom", "Zoom   AI")).toBe("Zoom AI");
    expect(getComponentFullName("Zoom", "Zoom\tAI")).toBe("Zoom AI");
    expect(getComponentFullName("Zoom  Video", "Web  SDK")).toBe(
      "Zoom Video Web SDK",
    );
  });

  test("falls back to the non-empty name", () => {
    expect(getComponentFullName("Zoom", "")).toBe("Zoom");
    expect(getComponentFullName("Zoom", "   ")).toBe("Zoom");
    expect(getComponentFullName("", "Zoom AI")).toBe("Zoom AI");
    expect(getComponentFullName("  ", "")).toBe("");
  });
});

describe("getHost", () => {
  test("returns the hostname without a www prefix", () => {
    expect(getHost("https://www.github.com/")).toBe("github.com");
    expect(getHost("https://api.vercel.com/v1")).toBe("api.vercel.com");
  });

  test("falls back to the input when it is not a URL", () => {
    expect(getHost("not a url")).toBe("not a url");
  });
});

describe("getCheckerHref", () => {
  test("links the checker with the url encoded", () => {
    expect(getCheckerHref("https://github.com")).toBe(
      "/play/checker?url=https%3A%2F%2Fgithub.com%2F",
    );
  });

  test("refuses non-http schemes and invalid urls", () => {
    expect(getCheckerHref("ftp://files.example.com")).toBeNull();
    expect(getCheckerHref("javascript:alert(1)")).toBeNull();
    expect(getCheckerHref("not a url")).toBeNull();
  });
});
