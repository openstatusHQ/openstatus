import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("tints the badge by variant", () => {
    const html = renderToStaticMarkup(
      <StatusBadge variant="destructive">Down</StatusBadge>,
    );
    expect(html).toContain("bg-destructive/10");
    expect(html).toContain("Down");
    expect(html).not.toContain('data-slot="status-dot"');
  });

  it("stays neutral and renders a coloured dot with dot", () => {
    const html = renderToStaticMarkup(
      <StatusBadge variant="success" dot>
        Up
      </StatusBadge>,
    );
    expect(html).not.toContain("bg-success/10");
    expect(html).toMatch(/data-slot="status-dot"[^>]*bg-success/);
  });

  it("uses the default tint without a variant", () => {
    expect(renderToStaticMarkup(<StatusBadge>Idle</StatusBadge>)).toContain(
      "bg-muted/50",
    );
  });
});
