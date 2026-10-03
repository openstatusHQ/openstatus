import { StatusEventTimelineReport } from "@openstatus/ui/components/blocks/status-events";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("StatusEventTimelineReport", () => {
  const updates = [
    {
      status: "resolved" as const,
      message: "Resolved",
      date: new Date("2026-09-03T09:55:00Z"),
    },
    {
      status: "monitoring" as const,
      message: "Monitoring",
      date: new Date("2026-09-02T10:00:00Z"),
    },
    {
      status: "investigating" as const,
      message: "Investigating",
      date: new Date("2026-08-31T05:00:00Z"),
    },
  ];

  test("shows each update's absolute timestamp", () => {
    const html = renderToStaticMarkup(
      createElement(StatusEventTimelineReport, { updates }),
    );
    expect(html).toContain("September 3 at 9:55 AM (UTC)");
    expect(html).toContain("September 2 at 10:00 AM (UTC)");
    expect(html).toContain("August 31 at 5:00 AM (UTC)");
  });

  test("shows the time since the first update on the resolved update only", () => {
    const html = renderToStaticMarkup(
      createElement(StatusEventTimelineReport, { updates }),
    );
    expect(html.split("(3 days)").length - 1).toBe(1);
    expect(html).not.toContain("(2 days)");
    expect(html).not.toContain("earlier");
  });

  test("shows no duration while the report is unresolved", () => {
    const html = renderToStaticMarkup(
      createElement(StatusEventTimelineReport, { updates: updates.slice(1) }),
    );
    expect(html).not.toContain("(2 days)");
  });

  test("shows no duration when resolved at the first update", () => {
    const html = renderToStaticMarkup(
      createElement(StatusEventTimelineReport, {
        updates: [{ ...updates[0], date: updates[2].date }, updates[2]],
      }),
    );
    expect(html).not.toMatch(/\(\d+ (seconds|minutes|hours|days)/);
  });
});
