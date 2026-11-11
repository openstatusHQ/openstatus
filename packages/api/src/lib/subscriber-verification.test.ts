import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSubscriberVerificationUrl } from "./subscriber-verification";

describe("buildSubscriberVerificationUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("constructs verification URL with default cloud domain", () => {
    vi.stubEnv("NODE_ENV", "production");
    const url = buildSubscriberVerificationUrl(
      { slug: "status-page", customDomain: null },
      "tok_123",
    );
    expect(url).toBe("https://status-page.openstatus.dev/verify/tok_123");
  });

  it("constructs verification URL with custom domain", () => {
    vi.stubEnv("NODE_ENV", "production");
    const url = buildSubscriberVerificationUrl(
      { slug: "status-page", customDomain: "status.acme.com" },
      "tok_123",
    );
    expect(url).toBe("https://status.acme.com/verify/tok_123");
  });

  it("constructs verification URL with STATUS_PAGE_BASE_URL override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STATUS_PAGE_BASE_URL", "https://status.example.net:8443");
    const url = buildSubscriberVerificationUrl(
      { slug: "status-page", customDomain: "unactive.acme.com" },
      "tok_123",
    );
    expect(url).toBe("https://status.example.net:8443/verify/tok_123");
  });

  it("constructs verification URL with {slug} templated STATUS_PAGE_BASE_URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STATUS_PAGE_BASE_URL", "https://{slug}.status.selfhost.org");
    const url = buildSubscriberVerificationUrl(
      { slug: "status-page", customDomain: null },
      "tok_123",
    );
    expect(url).toBe("https://status-page.status.selfhost.org/verify/tok_123");
  });
});
