import { THEMES } from "@openstatus/theme-store";
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { renderToStaticMarkup } from "react-dom/server";

import { ThemePromptButton } from "./theme-agent-actions";
import {
  ThemeBuilderProvider,
  useThemeBuilder,
} from "./theme-builder-provider";
import { ThemePasteDialog } from "./theme-paste-dialog";

function Probe() {
  const { theme, isModified } = useThemeBuilder();
  return (
    <p>
      {theme.id}|{String(isModified)}
    </p>
  );
}

function render(node: React.ReactNode, searchParams = "") {
  return renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={searchParams}>
      <ThemeBuilderProvider>{node}</ThemeBuilderProvider>
    </NuqsTestingAdapter>,
  );
}

describe("ThemeBuilderProvider", () => {
  it("starts from the default theme, unmodified", () => {
    expect(render(<Probe />)).toBe(`<p>${THEMES.default.id}|false</p>`);
  });

  it("starts from the theme in the `t` search param", () => {
    expect(render(<Probe />, "?t=dracula")).toBe("<p>dracula|false</p>");
  });

  it("falls back to the default theme for an unknown key", () => {
    expect(render(<Probe />, "?t=nope")).toBe(
      `<p>${THEMES.default.id}|false</p>`,
    );
  });

  it("throws when used outside the provider", () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(
      "useThemeBuilder must be used within ThemeBuilderProvider",
    );
  });
});

describe("theme builder actions", () => {
  it("renders the prompt and paste buttons", () => {
    const html = render(
      <>
        <ThemePromptButton />
        <ThemePasteDialog />
      </>,
    );
    expect(html).toContain("Copy prompt");
    expect(html).toContain("Paste");
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
