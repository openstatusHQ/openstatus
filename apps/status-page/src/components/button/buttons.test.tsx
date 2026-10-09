import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { ChartTooltipNumber } from "../chart/chart-tooltip-number";
import { PopoverQuantile } from "../popover/popover-quantile";
import { ButtonBack } from "./button-back";
import { ButtonCopyLink } from "./button-copy-link";

describe("ButtonBack", () => {
  it("links home by default", () => {
    const html = renderToStaticMarkup(<ButtonBack />);
    expect(html).toMatch(/<a [^>]*href="\/"/);
    expect(html).toContain("Back");
  });

  it("links to a custom href", () => {
    expect(renderToStaticMarkup(<ButtonBack href="/events" />)).toMatch(
      /<a [^>]*href="\/events"/,
    );
  });
});

describe("ButtonCopyLink", () => {
  it("has an accessible label", () => {
    expect(renderToStaticMarkup(<ButtonCopyLink />)).toMatch(
      /<span class="sr-only">Copy Link<\/span>/,
    );
  });
});

describe("PopoverQuantile", () => {
  it("wraps its children in a popover trigger", () => {
    const html = renderToStaticMarkup(<PopoverQuantile>p95</PopoverQuantile>);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("p95");
  });
});

describe("ChartTooltipNumber", () => {
  const chartConfig = { p50: { label: "P50" } };

  it("uses the config label and a millisecond suffix", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipNumber chartConfig={chartConfig} name="p50" value={120} />,
    );
    expect(html).toContain("<span>P50</span>");
    expect(html).toMatch(/120<span[^>]*>ms<\/span>/);
    expect(html).toContain("--color-bg:var(--color-p50)");
  });

  it("falls back to the series name", () => {
    expect(
      renderToStaticMarkup(
        <ChartTooltipNumber chartConfig={chartConfig} name="p99" value={1} />,
      ),
    ).toContain("<span>p99</span>");
  });

  it("prefers a custom label formatter", () => {
    expect(
      renderToStaticMarkup(
        <ChartTooltipNumber
          chartConfig={chartConfig}
          name="p50"
          value={1}
          labelFormatter={(_, name) => `median (${name})`}
        />,
      ),
    ).toContain("<span>median (p50)</span>");
  });
});
