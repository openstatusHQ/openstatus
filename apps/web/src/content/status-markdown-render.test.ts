import { describe, expect, test } from "vitest";

import {
  type MdIncident,
  renderComponentMarkdown,
  renderIndexMarkdown,
  renderServiceMarkdown,
} from "./status-markdown-render";

const NOW = Date.parse("2026-11-06T10:00:00Z");

function incident(over: Partial<MdIncident> = {}): MdIncident {
  return {
    name: "Elevated errors",
    status: "investigating",
    impact: "minor",
    url: "https://status.example.com/incidents/1",
    startedAt: new Date("2026-11-06T09:00:00Z"),
    createdAt: new Date("2026-11-06T09:00:00Z"),
    resolvedAt: null,
    ...over,
  };
}

const service = {
  name: "Acme",
  slug: "acme",
  url: "https://acme.dev",
  statusPageUrl: "https://status.acme.dev",
  description: null,
  effective: { indicator: "major", status: "partial_outage", escalated: false },
  checkedAt: NOW,
  stale: false,
  providerMessage: "API errors in EU",
  reporters: 3,
  windowMinutes: 15,
  activeIncidents: [incident()],
  recentIncidents: [incident({ resolvedAt: new Date("2026-11-06T10:12:00Z") })],
  components: [
    {
      slug: "api",
      name: "API",
      groupName: "Core",
      indicator: "major",
      status: "",
    },
    {
      slug: "web",
      name: "Web",
      groupName: null,
      indicator: "none",
      status: "",
    },
  ],
  history: [
    { day: "2026-11-06 00:00:00", worstIndicator: "major" },
    { day: "2026-11-05 00:00:00", worstIndicator: "none" },
  ],
  historyDays: 45,
};

describe("renderServiceMarkdown", () => {
  test("opens with the answer and lists what is affected", () => {
    const md = renderServiceMarkdown(service);
    expect(md.startsWith("# Is Acme down?\n\n**Answer:** Yes, Acme")).toBe(
      true,
    );
    expect(md).toContain("- Acme says: API errors in EU");
    expect(md).toContain("## Affected right now");
    expect(md).toContain(
      "| [Core / API](/status/acme/api.md) | partial outage |",
    );
    expect(md).not.toContain("[Web]");
    expect(md).toContain("1 of 2 tracked days without issues.");
    expect(md).toContain("| 2026-11-06 | partial outage |");
    expect(md).toContain("1 with issues (listed above), 1 operational.");
  });

  test("components without a live reading are not called operational", () => {
    const md = renderServiceMarkdown({
      ...service,
      components: service.components?.map((c) => ({
        ...c,
        indicator: "",
        status: "",
      })),
    });
    expect(md).toContain("2 without live data.");
    expect(md).not.toContain("All components operational.");
  });

  test("escapes markdown in catalog text, strikethrough included", () => {
    const md = renderServiceMarkdown({
      ...service,
      providerMessage: "~~fixed~~ *maybe*",
    });
    expect(md).toContain("\\~\\~fixed\\~\\~ \\*maybe\\*");
  });

  test("incident durations: resolved and ongoing", () => {
    const md = renderServiceMarkdown(service);
    expect(md).toContain("| minor | ongoing |");
    expect(md).toContain("| minor | 1h 12m |");
  });

  test("no live data reads as unknown, never stale without a check", () => {
    const md = renderServiceMarkdown({ ...service, checkedAt: 0, stale: true });
    expect(md).toContain("- Status: unknown");
    expect(md).toContain("- Checked: no data\n");
  });

  test("escapes pipes in table cells", () => {
    const md = renderServiceMarkdown({
      ...service,
      activeIncidents: [incident({ name: "A | B" })],
    });
    expect(md).toContain("[A \\| B]");
  });
});

describe("renderComponentMarkdown", () => {
  test("links back to the service", () => {
    const md = renderComponentMarkdown({
      serviceName: "Acme",
      serviceSlug: "acme",
      statusPageUrl: "https://status.acme.dev",
      fullName: "Acme API",
      component: { ...service.components[0], description: null },
      checkedAt: NOW,
      stale: false,
      reporters: 0,
      windowMinutes: 15,
      incidents: [],
      history: [],
      historyDays: 45,
    });
    expect(md).toContain("- Part of: [Acme](/status/acme.md) / Core");
    expect(md).toContain("No recent incidents.");
  });
});

describe("renderIndexMarkdown", () => {
  test("issues first, worst first, and only for services with data", () => {
    const md = renderIndexMarkdown({
      description: "d",
      popularSlugs: ["b", "gone"],
      services: [
        {
          slug: "a",
          name: "A",
          indicator: "minor",
          status: "",
          statusMessage: "slow",
          hasData: true,
        },
        {
          slug: "b",
          name: "B",
          indicator: "critical",
          status: "",
          statusMessage: null,
          hasData: true,
        },
        {
          slug: "c",
          name: "C",
          indicator: "major",
          status: "",
          statusMessage: null,
          hasData: false,
        },
      ],
    });
    expect(md).toContain("## Having issues now (2)");
    expect(md.indexOf("| [B]")).toBeLessThan(md.indexOf("| [A]"));
    expect(md).not.toContain("| [C]");
    expect(md).toContain("## Popular\n\n- [B](/status/b.md): major outage\n\n");
    expect(md).toContain("- [C](/status/c.md): unknown");
  });
});
