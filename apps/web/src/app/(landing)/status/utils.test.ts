import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { getComponentFullName } from "./utils";

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
