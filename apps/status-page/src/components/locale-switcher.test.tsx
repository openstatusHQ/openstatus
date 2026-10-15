import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { LocaleSwitcher } from "./locale-switcher";

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
