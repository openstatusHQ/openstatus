import { describe, expect, it } from "vitest";

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
  it("follows the sidebar order", () => {
    expect(navigationGroup().items.map((i) => i.label)).toEqual([
      "Overview",
      "Assistant",
      "Monitors",
      "Uptime Targets",
      "Maintenance Windows",
      "Private Locations",
      "Incidents",
      "Notifications",
      "On-call",
      "Status Pages",
      "Agents",
      "Slack Agent",
      "MCP",
      "Developers",
      "API Keys",
      "CLI",
    ]);
  });

  it("navigates to each item's href", () => {
    expect(navigationGroup().items.map((item) => item.action)).toEqual(
      [
        "/overview",
        "/chat",
        "/monitors",
        "/uptime-targets",
        "/maintenance-windows",
        "/private-locations",
        "/incidents",
        "/notifications",
        "/on-call",
        "/status-pages",
        "/agents/slack",
        "/agents/slack",
        "/agents/mcp",
        "/developers/api-keys",
        "/developers/api-keys",
        "/developers/cli",
      ].map((href) => ({ type: "navigate", href })),
    );
  });

  it("finds API keys and the CLI by what people type", () => {
    const items = navigationGroup().items;
    const keywords = (label: string) =>
      items.find((i) => i.label === label)?.keywords ?? [];
    expect(keywords("API Keys")).toEqual(
      expect.arrayContaining(["api key", "token", "terraform"]),
    );
    expect(keywords("CLI")).toContain("terminal");
    expect(keywords("Uptime Targets")).toEqual(
      expect.arrayContaining(["sla", "report", "reporting", "availability"]),
    );
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
    const members = settingsGroup().items.find(
      (i) => i.label === "Team Members",
    );
    expect(members?.action).toEqual({
      type: "navigate",
      href: "/settings/general#team-members",
    });
  });

  it("finds every item by typing settings", () => {
    for (const item of settingsGroup().items) {
      expect(item.keywords).toContain("settings");
    }
  });

  it("keeps values unique", () => {
    const values = settingsGroup().items.map((i) => i.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("helpGroup", () => {
  it("opens the support sheet first", () => {
    const [support] = helpGroup(() => {}).items;
    expect(support.action).toEqual({
      type: "sheet",
      sheet: { sheet: "support" },
    });
  });

  it("copies the agent prompt second", () => {
    let calls = 0;
    const [, ask] = helpGroup(() => calls++).items;
    if (ask.action.type === "run") ask.action.run();
    expect(calls).toBe(1);
  });

  it("opens help links externally", () => {
    const links = helpGroup(() => {}).items.slice(2);
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
