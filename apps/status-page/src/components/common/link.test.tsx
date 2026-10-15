import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { renderToStaticMarkup } from "react-dom/server";

import { Link } from "./link";

function render(props: React.ComponentProps<typeof Link>, searchParams = "") {
  return renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={searchParams}>
      <Link {...props} />
    </NuqsTestingAdapter>,
  );
}

describe("Link", () => {
  it("keeps internal links in the same tab outside embeds", () => {
    const html = render({ href: "/events", children: "Events" });
    expect(html).toContain('href="/events"');
    expect(html).not.toContain("target=");
  });

  it("opens internal links in a new tab inside an embed", () => {
    const html = render({ href: "/events", children: "Events" }, "?embed=all");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("keeps a caller-provided rel inside an embed", () => {
    const html = render(
      { href: "/events", rel: "nofollow", children: "Events" },
      "?embed=feed",
    );
    expect(html).toContain('rel="nofollow"');
  });

  for (const href of [
    "https://openstatus.dev",
    "mailto:ops@acme.dev",
    "tel:+123",
    "//cdn.acme.dev",
    "#components",
  ]) {
    it(`leaves ${href} untouched inside an embed`, () => {
      expect(render({ href, children: "x" }, "?embed=all")).not.toContain(
        'target="_blank"',
      );
    });
  }

  it("respects an explicit target outside embeds", () => {
    expect(
      render({ href: "https://x.dev", target: "_blank", children: "x" }),
    ).toContain('target="_blank"');
  });

  it("applies the variant classes", () => {
    expect(render({ href: "/", children: "x" })).toContain("font-medium");
    expect(
      render({ href: "/", variant: "unstyled", children: "x" }),
    ).not.toContain("font-medium");
  });
});
