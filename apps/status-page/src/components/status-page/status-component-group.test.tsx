import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { StatusComponentGroup } from "./status-component-group";

describe("StatusComponentGroup", () => {
  it("renders the title and carries the aggregated status", () => {
    const html = renderToStaticMarkup(
      <StatusComponentGroup title="API" status="degraded" />,
    );
    expect(html).toContain("API");
    expect(html).toMatch(/<button[^>]*data-variant="degraded"/);
  });

  it("starts collapsed by default", () => {
    const html = renderToStaticMarkup(
      <StatusComponentGroup title="API">
        <span>child component</span>
      </StatusComponentGroup>,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("child component");
  });

  it("shows children when open by default", () => {
    const html = renderToStaticMarkup(
      <StatusComponentGroup title="API" defaultOpen>
        <span>child component</span>
      </StatusComponentGroup>,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("child component");
  });
});
