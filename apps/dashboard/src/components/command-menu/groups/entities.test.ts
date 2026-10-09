import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  incidentsGroup,
  maintenancesGroup,
  monitorsGroup,
  statusPagesGroup,
  statusReportsGroup,
  workspacesGroup,
} from "./entities";

// safe because each group builder only reads the fields set in the fixtures
function rows<T>(items: Record<string, unknown>[]): T[] {
  return items as unknown as T[];
}

type Arg<F extends (...args: never[]) => unknown> = NonNullable<
  Parameters<F>[0]
>[number];

describe("empty input", () => {
  it("returns null so the group is hidden", () => {
    expect(incidentsGroup(undefined)).toBeNull();
    expect(incidentsGroup([])).toBeNull();
    expect(monitorsGroup(undefined)).toBeNull();
    expect(statusPagesGroup([])).toBeNull();
    expect(statusReportsGroup(undefined)).toBeNull();
    expect(maintenancesGroup([], new Map())).toBeNull();
    expect(workspacesGroup([], () => {})).toBeNull();
  });
});

describe("incidentsGroup", () => {
  const group = incidentsGroup(
    rows<Arg<typeof incidentsGroup>>([
      {
        id: 1,
        title: "API down",
        status: "open",
        severity: "critical",
        commander: { name: "Ada" },
      },
      {
        id: 2,
        title: "Slow DB",
        status: "mitigated",
        severity: "minor",
        commander: null,
      },
    ]),
  );

  it("caps idle items and links to the incident", () => {
    expect(group?.idleLimit).toBe(5);
    expect(group?.items[0]).toMatchObject({
      value: "incident-1",
      label: "API down",
      description: "open · critical",
      action: { type: "navigate", href: "/incidents/1" },
    });
  });

  it("searches by commander only when one is assigned", () => {
    expect(group?.items[0].keywords).toEqual([
      "API down",
      "open",
      "critical",
      "Ada",
    ]);
    expect(group?.items[1].keywords).toEqual(["Slow DB", "mitigated", "minor"]);
  });
});

describe("monitorsGroup", () => {
  it("pushes the monitor scope page", () => {
    const group = monitorsGroup(
      rows<Arg<typeof monitorsGroup>>([
        { id: 3, name: "API", url: "https://api.acme.dev" },
      ]),
    );
    expect(group?.items[0]).toMatchObject({
      value: "monitor-3",
      description: "https://api.acme.dev",
      keywords: ["API", "https://api.acme.dev"],
      action: { type: "push", page: { type: "monitor", id: 3, name: "API" } },
    });
  });
});

describe("statusPagesGroup", () => {
  it("pushes the status page scope and indexes the custom domain", () => {
    const group = statusPagesGroup(
      rows<Arg<typeof statusPagesGroup>>([
        { id: 4, title: "Acme", slug: "acme", customDomain: "status.acme.dev" },
        { id: 5, title: "Beta", slug: "beta", customDomain: "" },
      ]),
    );
    expect(group?.items[0]).toMatchObject({
      value: "status-page-4",
      description: "acme",
      keywords: ["Acme", "acme", "status.acme.dev"],
      action: {
        type: "push",
        page: { type: "status-page", id: 4, title: "Acme" },
      },
    });
    expect(group?.items[1].keywords).toEqual(["Beta", "beta"]);
  });
});

describe("statusReportsGroup", () => {
  it("links into the report under its page", () => {
    const group = statusReportsGroup(
      rows<Arg<typeof statusReportsGroup>>([
        {
          id: 9,
          pageId: 4,
          title: "Outage",
          status: "investigating",
          page: { title: "Acme" },
        },
      ]),
    );
    expect(group?.items[0]).toMatchObject({
      value: "status-report-9",
      description: "investigating · Acme",
      keywords: ["Outage", "investigating", "Acme"],
      action: { type: "navigate", href: "/status-pages/4/status-reports/9" },
    });
  });
});

describe("maintenancesGroup", () => {
  const from = new Date("2024-06-01T10:00:00Z");

  it("links to the page's maintenances and indexes the page title", () => {
    const group = maintenancesGroup(
      rows<Arg<typeof maintenancesGroup>>([
        { id: 11, pageId: 4, title: "DB upgrade", from },
      ]),
      new Map([[4, "Acme"]]),
    );
    expect(group?.items[0]).toMatchObject({
      value: "maintenance-11",
      description: from.toLocaleString(),
      keywords: ["DB upgrade", "Acme"],
      action: { type: "navigate", href: "/status-pages/4/maintenances" },
    });
  });

  it("drops the page keyword when the page is unknown", () => {
    const group = maintenancesGroup(
      rows<Arg<typeof maintenancesGroup>>([
        { id: 12, pageId: 99, title: "Patch", from },
      ]),
      new Map(),
    );
    expect(group?.items[0].keywords).toEqual(["Patch"]);
  });
});

describe("workspacesGroup", () => {
  it("switches to the selected workspace slug", () => {
    const switched: string[] = [];
    const group = workspacesGroup(
      rows<Parameters<typeof workspacesGroup>[0][number]>([
        { id: 1, name: "Acme", slug: "acme" },
        { id: 2, name: "", slug: "unnamed" },
      ]),
      (slug) => switched.push(slug),
    );
    const [acme, unnamed] = group?.items ?? [];
    expect(acme.value).toBe("workspace-1");
    expect(unnamed.label).toBe("Untitled Workspace");
    expect(unnamed.keywords).toEqual(["Untitled Workspace", "unnamed"]);
    if (unnamed.action.type === "run") unnamed.action.run();
    expect(switched).toEqual(["unnamed"]);
  });

  it("does not cap idle items", () => {
    const group = workspacesGroup(
      rows<Parameters<typeof workspacesGroup>[0][number]>([
        { id: 1, name: "Acme", slug: "acme" },
      ]),
      () => {},
    );
    expect(group?.idleLimit).toBeUndefined();
  });
});
