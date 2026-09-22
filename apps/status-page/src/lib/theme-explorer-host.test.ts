import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  isCanonicalThemeExplorerHost,
  isThemeExplorerHost,
} from "./theme-explorer-host";

describe("isThemeExplorerHost", () => {
  test("allows the canonical host", () => {
    expect(isThemeExplorerHost("themes.openstatus.dev")).toBe(true);
    expect(isThemeExplorerHost("THEMES.OPENSTATUS.DEV")).toBe(true);
  });

  test("allows the internal origin and local/preview hosts", () => {
    expect(isThemeExplorerHost("www.stpg.dev")).toBe(true);
    expect(isThemeExplorerHost("stpg.dev")).toBe(true);
    expect(isThemeExplorerHost("localhost:3000")).toBe(true);
    expect(isThemeExplorerHost("status-page-git-main.vercel.app")).toBe(true);
  });

  test("rejects status page hosts", () => {
    expect(isThemeExplorerHost("acme.openstatus.dev")).toBe(false);
    expect(isThemeExplorerHost("acme.stpg.dev")).toBe(false);
    expect(isThemeExplorerHost("status.acme.com")).toBe(false);
    expect(isThemeExplorerHost("acme.localhost:3000")).toBe(false);
  });

  test("rejects look-alike hosts", () => {
    expect(isThemeExplorerHost("themes.openstatus.dev.evil.com")).toBe(false);
    expect(isThemeExplorerHost("eviltheme.openstatus.dev")).toBe(false);
    expect(isThemeExplorerHost(null)).toBe(false);
    expect(isThemeExplorerHost(undefined)).toBe(false);
  });
});

describe("isCanonicalThemeExplorerHost", () => {
  test("only the published host is indexable", () => {
    expect(isCanonicalThemeExplorerHost("themes.openstatus.dev")).toBe(true);
    expect(isCanonicalThemeExplorerHost("www.stpg.dev")).toBe(false);
    expect(isCanonicalThemeExplorerHost("localhost:3000")).toBe(false);
  });
});
