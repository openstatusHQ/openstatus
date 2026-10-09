import { expect } from "@std/expect";
import { afterEach, describe, it } from "@std/testing/bdd";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { renderToStaticMarkup } from "react-dom/server";

import { pathnamePrefix } from "@/test/use-pathname-prefix.mock";

import { StatusFeed } from "./status-feed";

type Props = React.ComponentProps<typeof StatusFeed>;

function render(props: Props = {}) {
  return renderToStaticMarkup(
    <NuqsTestingAdapter>
      <StatusFeed {...props} />
    </NuqsTestingAdapter>,
  );
}

const report = {
  id: 7,
  title: "API outage",
  affected: ["API"],
  updates: [
    {
      date: new Date("2024-05-01T10:00:00Z"),
      status: "investigating" as const,
      message: "Looking into **errors**.",
    },
  ],
};

const maintenance = {
  id: 3,
  title: "DB upgrade",
  affected: [],
  message: "Planned work",
  from: new Date("2024-06-01T10:00:00Z"),
  to: new Date("2024-06-01T11:00:00Z"),
};

afterEach(() => {
  pathnamePrefix.value = "";
});

describe("StatusFeed", () => {
  it("links to the events history when empty", () => {
    const html = render();
    expect(html).toContain('href="/events"');
    expect(html).toContain("View events history");
  });

  it("links each event to its detail page", () => {
    const html = render({
      statusReports: [report],
      maintenances: [maintenance],
    });
    expect(html).toContain('href="/events/report/7"');
    expect(html).toContain('href="/events/maintenance/3"');
  });

  it("prefixes links with the locale or slug", () => {
    pathnamePrefix.value = "acme";
    const html = render({ statusReports: [report] });
    expect(html).toContain('href="/acme/events/report/7"');
    expect(html).toContain('href="/acme/events"');
  });

  it("lists the newest event first", () => {
    const html = render({
      statusReports: [report],
      maintenances: [maintenance],
    });
    expect(html.indexOf("DB upgrade")).toBeLessThan(html.indexOf("API outage"));
  });

  it("renders report messages as markdown", () => {
    expect(render({ statusReports: [report] })).toContain(
      "<strong>errors</strong>",
    );
  });
});
