import { describe, expect, it } from "vitest";

import { getPageUrl } from "./status-pages.client";

describe("getPageUrl", () => {
  it("defaults to {slug}.openstatus.dev", () => {
    expect(getPageUrl({ slug: "acme", customDomain: null })).toBe(
      "https://acme.openstatus.dev",
    );
    expect(getPageUrl({ slug: "acme", customDomain: "" })).toBe(
      "https://acme.openstatus.dev",
    );
  });

  it("uses the runtime base domain", () => {
    expect(
      getPageUrl(
        { slug: "internal", customDomain: null },
        "status.example.com",
      ),
    ).toBe("https://internal.status.example.com");
  });

  it("prefers the custom domain", () => {
    expect(
      getPageUrl(
        { slug: "acme", customDomain: "status.acme.com" },
        "status.example.com",
      ),
    ).toBe("https://status.acme.com");
  });
});
