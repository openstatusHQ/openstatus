import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { HELP_LINKS } from "@/config/help";
import { SETTINGS_TABS } from "@/config/settings";

import {
  createGroup,
  createMaintenanceItem,
  createStatusReportItem,
  helpGroup,
  navigationGroup,
  settingsGroup,
  themeGroup,
} from "./static";

describe("navigationGroup", () => {
  it("places Incidents right after Overview", () => {
    const labels = navigationGroup().items.map((i) => i.label);
    expect(labels.slice(0, 2)).toEqual(["Overview", "Incidents"]);
  });

  it("lists Incidents exactly once", () => {
    const labels = navigationGroup().items.map((i) => i.label);
    expect(labels.filter((l) => l === "Incidents")).toHaveLength(1);
  });

  it("navigates to each item's href", () => {
    const overview = navigationGroup().items[0];
    expect(overview.action).toEqual({ type: "navigate", href: "/overview" });
  });

  it("keeps values unique", () => {
    const values = navigationGroup().items.map((i) => i.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("createStatusReportItem / createMaintenanceItem", () => {
  it("opens the sheet without a page at the root", () => {
    expect(createStatusReportItem().action).toEqual({
      type: "sheet",
      sheet: { sheet: "status-report", pageId: undefined },
    });
    expect(createMaintenanceItem().action).toEqual({
      type: "sheet",
      sheet: { sheet: "maintenance", pageId: undefined },
    });
  });

  it("passes the page id through when scoped", () => {
    expect(createStatusReportItem(7).action).toEqual({
      type: "sheet",
      sheet: { sheet: "status-report", pageId: 7 },
    });
    expect(createMaintenanceItem(7).action).toEqual({
      type: "sheet",
      sheet: { sheet: "maintenance", pageId: 7 },
    });
  });

  it("uses a distinct value when scoped so it never collides with the root item", () => {
    expect(createStatusReportItem().value).toBe("Create Status Report");
    expect(createStatusReportItem(7).value).toBe("create-status-report");
    expect(createMaintenanceItem().value).toBe("Create Maintenance");
    expect(createMaintenanceItem(7).value).toBe("create-maintenance");
  });
});

describe("createGroup", () => {
  it("leads with Declare Incident", () => {
    const [first] = createGroup().items;
    expect(first.label).toBe("Declare Incident");
    expect(first.action).toEqual({
      type: "sheet",
      sheet: { sheet: "declare-incident" },
    });
  });

  it("routes monitor and status page creation to their pages", () => {
    const hrefs = createGroup().items.flatMap((i) =>
      i.action.type === "navigate" ? [i.action.href] : [],
    );
    expect(hrefs).toEqual(["/monitors/create", "/status-pages/create"]);
  });
});

describe("settingsGroup", () => {
  it("starts with every settings tab", () => {
    const items = settingsGroup().items;
    expect(items.slice(0, SETTINGS_TABS.length).map((i) => i.label)).toEqual(
      SETTINGS_TABS.map((t) => t.label),
    );
  });

  it("deep-links to settings anchors", () => {
    const apiKeys = settingsGroup().items.find((i) => i.label === "API Keys");
    expect(apiKeys?.action).toEqual({
      type: "navigate",
      href: "/settings/general#api-keys",
    });
  });

  it("keeps values unique", () => {
    const values = settingsGroup().items.map((i) => i.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("helpGroup", () => {
  it("opens the support sheet first", () => {
    const [support] = helpGroup().items;
    expect(support.action).toEqual({
      type: "sheet",
      sheet: { sheet: "support" },
    });
  });

  it("opens help links externally", () => {
    const links = helpGroup().items.slice(1);
    expect(links.map((i) => i.action)).toEqual(
      HELP_LINKS.map((l) => ({ type: "external", href: l.href })),
    );
  });
});

describe("themeGroup", () => {
  function toggle(resolvedTheme: string | undefined) {
    const calls: string[] = [];
    const [item] = themeGroup(resolvedTheme, (t) => calls.push(t)).items;
    if (item.action.type === "run") item.action.run();
    return { label: item.label, calls };
  }

  it("switches dark to light", () => {
    expect(toggle("dark")).toEqual({
      label: "Switch to light theme",
      calls: ["light"],
    });
  });

  it("switches light or unknown to dark", () => {
    expect(toggle("light").calls).toEqual(["dark"]);
    expect(toggle(undefined)).toEqual({
      label: "Switch to dark theme",
      calls: ["dark"],
    });
  });
});
