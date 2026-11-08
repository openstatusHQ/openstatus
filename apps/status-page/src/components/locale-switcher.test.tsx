import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleSwitcher, resolveLocaleSwitchPath } from "./locale-switcher";

describe("LocaleSwitcher", () => {
  it("renders nothing for a single-locale page", () => {
    expect(renderToStaticMarkup(<LocaleSwitcher pageLocales={["en"]} />)).toBe(
      "",
    );
    expect(renderToStaticMarkup(<LocaleSwitcher pageLocales={null} />)).toBe(
      "",
    );
    expect(renderToStaticMarkup(<LocaleSwitcher />)).toBe("");
  });

  it("renders a skeleton before mount on a multi-locale page", () => {
    expect(
      renderToStaticMarkup(<LocaleSwitcher pageLocales={["en", "fr"]} />),
    ).toContain('data-slot="status-locale-switcher-skeleton"');
  });
});

describe("resolveLocaleSwitchPath", () => {
  it("replaces a lowercase region locale", () => {
    expect(
      resolveLocaleSwitchPath({
        pathname: "/acme/zh-cn/events",
        domain: "acme",
        nextLocale: "fr",
        defaultLocale: "en",
      }),
    ).toBe("/acme/fr/events");
  });
});
