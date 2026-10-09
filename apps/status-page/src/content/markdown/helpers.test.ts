import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  canonicalUrl,
  componentImpact,
  componentImpactExplicit,
  dominantDayStatus,
  escapeCell,
  escapeLinkLabel,
  eventLog,
  formatDate,
  formatDay,
  formatDayTime,
  formatLogStamp,
  formatMs,
  formatPercent,
  formatStamp,
  frontmatter,
  humanDuration,
  mdUrl,
  navLine,
  relativeTime,
  reportStatusGlyph,
  statusGlyph,
  statusLabel,
  table,
  uptimeBar,
  withPoweredBy,
  worstImpact,
} from "./helpers";

describe("statusLabel", () => {
  test("labels component and report statuses", () => {
    expect(statusLabel("error")).toBe("Outage");
    expect(statusLabel("info")).toBe("Maintenance");
    expect(statusLabel("identified")).toBe("Identified");
  });

  test("passes unknown statuses through", () => {
    expect(statusLabel("custom")).toBe("custom");
  });
});

describe("frontmatter", () => {
  const base = {
    title: "Acme",
    description: "Status",
    baseUrl: "https://status.acme.com",
    canonical: "https://status.acme.com",
  };

  test("quotes and escapes YAML scalars", () => {
    const out = frontmatter({
      ...base,
      title: 'Say "hi"\\\nnext\tline\u0001',
    });
    expect(out).toContain('title: "Say \\"hi\\"\\\\\\nnext\\tline\\x01"');
  });

  test("omits optional urls when absent", () => {
    const out = frontmatter(base);
    expect(out).not.toContain("homepage_url");
    expect(out).not.toContain("contact_url");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out.endsWith("---\n")).toBe(true);
  });

  test("includes live state and drops an invalid fetched_at", () => {
    const out = frontmatter({
      ...base,
      live: {
        status: "degraded",
        fetchedAt: "not a date",
        activeReports: 1,
        activeMaintenance: 0,
        componentsOperational: 3,
        componentsTotal: 4,
        worstComponent: "API",
      },
    });
    expect(out).toContain('status: "degraded"');
    expect(out).not.toContain("fetched_at");
    expect(out).toContain("components_operational: 3");
    expect(out).toContain('worst_component: "API"');
  });

  test("renders fetched_at as ISO", () => {
    const out = frontmatter({
      ...base,
      live: {
        status: "operational",
        fetchedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
        activeReports: 0,
        activeMaintenance: 0,
        componentsOperational: 1,
        componentsTotal: 1,
      },
    });
    expect(out).toContain('fetched_at: "2026-01-02T03:04:05.000Z"');
  });
});

describe("escapeCell / escapeLinkLabel / table", () => {
  test("escapes pipes and backslashes and flattens newlines", () => {
    expect(escapeCell(" a|b\\c\r\nd ")).toBe("a\\|b\\\\c d");
  });

  test("escapes brackets in link labels", () => {
    expect(escapeLinkLabel("[beta] api\\")).toBe("\\[beta\\] api\\\\");
  });

  test("renders a header-only table when there are no rows", () => {
    expect(table(["A", "B"], [])).toBe("| A | B |\n| --- | --- |");
  });

  test("renders escaped rows", () => {
    expect(table(["A"], [["x|y"]])).toBe("| A |\n| --- |\n| x\\|y |");
  });
});

describe("number and date formatting", () => {
  test("formatDate returns ISO or a dash", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("nope")).toBe("—");
    expect(formatDate(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  test("formatMs rounds and handles missing values", () => {
    expect(formatMs(12.6)).toBe("13ms");
    expect(formatMs(undefined)).toBe("—");
    expect(formatMs(Number.NaN)).toBe("—");
  });

  test("formatPercent keeps three decimals", () => {
    expect(formatPercent(0.99987)).toBe("99.987%");
    expect(formatPercent(1)).toBe("100.000%");
  });

  const instant = Date.UTC(2026, 5, 18, 14, 5);

  test("formats in UTC", () => {
    expect(formatDay(instant)).toBe("Jun 18, 2026");
    expect(formatDayTime(instant)).toBe("Jun 18, 2:05 PM");
    expect(formatLogStamp(instant)).toBe("2026-06-18 14:05");
    expect(formatStamp(instant)).toBe("Jun 18, 2026 14:05 (GMT+0)");
  });

  test("formatDayTime uses 12 for midnight and noon", () => {
    expect(formatDayTime(Date.UTC(2026, 0, 1, 0, 0))).toBe("Jan 1, 12:00 AM");
    expect(formatDayTime(Date.UTC(2026, 0, 1, 12, 0))).toBe("Jan 1, 12:00 PM");
    expect(formatDayTime("bad")).toBe("—");
  });
});

describe("urls and navigation", () => {
  test("canonicalUrl joins without a double slash", () => {
    expect(canonicalUrl("https://x.dev", "/events")).toBe(
      "https://x.dev/events",
    );
    expect(canonicalUrl("https://x.dev")).toBe("https://x.dev");
  });

  test("mdUrl maps the root to /.md", () => {
    expect(mdUrl()).toBe("/.md");
    expect(mdUrl("/events/1")).toBe("/events/1.md");
  });

  test("navLine links items with a url and escapes labels", () => {
    expect(
      navLine([{ label: "Home", url: "/.md" }, { label: "[Event]" }]),
    ).toBe("[Home](/.md) › \\[Event\\]");
  });
});

describe("status glyphs", () => {
  test("falls back to the empty glyph", () => {
    expect(statusGlyph("error")).toBe("x");
    expect(statusGlyph("unknown")).toBe(".");
  });

  test("maps report statuses", () => {
    expect(reportStatusGlyph("resolved")).toBe("+");
    expect(reportStatusGlyph("maintenance")).toBe("=");
    expect(reportStatusGlyph("investigating")).toBe("x");
  });

  test("dominantDayStatus picks the worst non-empty segment", () => {
    expect(
      dominantDayStatus([
        { status: "success", height: 90 },
        { status: "degraded", height: 10 },
        { status: "error", height: 0 },
      ]),
    ).toBe("degraded");
    expect(dominantDayStatus([])).toBe("empty");
  });

  test("uptimeBar renders one glyph per day in a code span", () => {
    expect(uptimeBar([])).toBe("");
    expect(
      uptimeBar([
        { bar: [{ status: "success", height: 1 }] },
        { bar: [{ status: "error", height: 1 }] },
        { bar: [] },
      ]),
    ).toBe("`+x.`");
  });
});

describe("impacts", () => {
  test("componentImpact hides operational", () => {
    expect(componentImpact("API", "operational")).toBe("API");
    expect(componentImpact("API", null)).toBe("API");
    expect(componentImpact("API", "partial_outage")).toBe(
      "API (partial outage)",
    );
  });

  test("componentImpactExplicit keeps operational", () => {
    expect(componentImpactExplicit("API", "operational")).toBe(
      "API (operational)",
    );
  });

  test("worstImpact returns the most severe", () => {
    expect(worstImpact([])).toBeNull();
    expect(
      worstImpact(["degraded_performance", "major_outage", "operational"]),
    ).toBe("major_outage");
  });
});

describe("eventLog", () => {
  test("is empty without rows", () => {
    expect(eventLog([])).toBe("");
  });

  test("sorts newest first and strips newlines from titles", () => {
    const out = eventLog([
      {
        timestamp: Date.UTC(2026, 0, 1, 9, 0),
        label: "Investigating",
        glyph: "x",
        ref: "#1",
        title: "first",
      },
      {
        timestamp: Date.UTC(2026, 0, 2, 9, 0),
        label: "Resolved",
        glyph: "+",
        ref: "#1",
        title: "fixed\n```",
      },
    ]).split("\n");
    expect(out[0]).toBe("```text");
    expect(out[2]).toContain("2026-01-02 09:00");
    expect(out[2]).toContain("fixed ```");
    expect(out[3]).toContain("2026-01-01 09:00");
    expect(out.at(-1)).toBe("```");
    expect(out).toHaveLength(5);
  });
});

describe("relativeTime / humanDuration", () => {
  const now = Date.UTC(2026, 5, 1);

  test("reports just now under a minute", () => {
    expect(relativeTime(now - 30_000, now)).toBe("just now");
  });

  test("uses singular and plural units", () => {
    expect(relativeTime(now - 60_000, now)).toBe("1 minute ago");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3 hours ago");
    expect(relativeTime(now - 86_400_000, now)).toBe("1 day ago");
    expect(relativeTime(now - 400 * 86_400_000, now)).toBe("1 year ago");
  });

  test("humanDuration clamps negative spans", () => {
    expect(humanDuration(now, now - 10_000)).toBe("1 minute");
    expect(humanDuration(now, now + 9 * 86_400_000)).toBe("9 days");
  });
});

describe("withPoweredBy", () => {
  test("appends the footer unless white-labeled", () => {
    expect(withPoweredBy("# Hi", true)).toBe("# Hi");
    expect(withPoweredBy("# Hi", false)).toContain("openstatus.dev");
  });
});
