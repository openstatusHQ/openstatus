import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { DatePicker } from "./date-picker";

const day = 86_400_000;
const now = new Date();
const presets = [
  {
    id: "1d",
    label: "Last day",
    shortcut: "d",
    values: { from: new Date(now.getTime() - day), to: now },
  },
  {
    id: "7d",
    label: "Last 7 days",
    shortcut: "w",
    values: { from: new Date(now.getTime() - 7 * day), to: now },
  },
];

function presetVariants(html: string) {
  return [
    ...html.matchAll(/data-variant="(\w+)"[^>]*>\s*<span>([^<]+)<\/span>/g),
  ].map((m) => [m[2], m[1]]);
}

describe("DatePicker", () => {
  it("highlights the preset matching the range", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        range={presets[1].values}
        onSelect={() => {}}
        presets={presets}
      />,
    );
    expect(presetVariants(html)).toEqual([
      ["Last day", "ghost"],
      ["Last 7 days", "outline"],
    ]);
  });

  it("highlights nothing for a custom range", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        range={{ from: new Date(now.getTime() - 2 * day), to: now }}
        onSelect={() => {}}
        presets={presets}
      />,
    );
    expect(presetVariants(html).map(([, v]) => v)).toEqual(["ghost", "ghost"]);
  });

  it("fills the custom range inputs in local time", () => {
    const from = new Date(2024, 0, 5, 9, 7);
    const html = renderToStaticMarkup(
      <DatePicker range={{ from }} onSelect={() => {}} presets={presets} />,
    );
    expect(html).toMatch(/id="from"[^>]*value="2024-01-05T09:07"/);
    expect(html).toMatch(/id="to"[^>]*value=""/);
  });

  it("limits the inputs to the oldest preset", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        range={{ from: undefined }}
        onSelect={() => {}}
        presets={presets}
      />,
    );
    const min = presets[1].values.from;
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${min.getFullYear()}-${pad(min.getMonth() + 1)}-${pad(min.getDate())}T${pad(min.getHours())}:${pad(min.getMinutes())}`;
    expect(html).toContain(`min="${expected}"`);
  });

  it("shows the preset shortcuts", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        range={{ from: undefined }}
        onSelect={() => {}}
        presets={presets}
      />,
    );
    expect(html).toMatch(/Last day[\s\S]*>d<\/kbd>/);
  });
});
