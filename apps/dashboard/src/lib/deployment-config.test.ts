import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEPLOYMENT_CONFIG,
  getDeploymentConfig,
  getStatusPageHost,
  getStatusPageUrl,
  normalizeBaseDomain,
} from "./deployment-config";

describe("getDeploymentConfig", () => {
  it("defaults to hosted openstatus.dev", () => {
    expect(getDeploymentConfig({})).toEqual({
      statusPageBaseDomain: "openstatus.dev",
      isSelfHosted: false,
    });
    expect(DEFAULT_DEPLOYMENT_CONFIG).toEqual(getDeploymentConfig({}));
  });

  it("reads STATUS_PAGE_BASE_DOMAIN and SELF_HOST", () => {
    expect(
      getDeploymentConfig({
        STATUS_PAGE_BASE_DOMAIN: "status.example.com",
        SELF_HOST: "true",
      }),
    ).toEqual({
      statusPageBaseDomain: "status.example.com",
      isSelfHosted: true,
    });
  });

  it("only the exact string 'true' means self-hosted", () => {
    expect(getDeploymentConfig({ SELF_HOST: "false" }).isSelfHosted).toBe(
      false,
    );
    expect(getDeploymentConfig({ SELF_HOST: "1" }).isSelfHosted).toBe(false);
  });
});

describe("normalizeBaseDomain", () => {
  it("empty → openstatus.dev", () => {
    expect(normalizeBaseDomain("")).toBe("openstatus.dev");
    expect(normalizeBaseDomain(undefined)).toBe("openstatus.dev");
  });

  it("strips scheme, path, port, dots and case", () => {
    expect(normalizeBaseDomain("https://Status.Example.com:8443/x")).toBe(
      "status.example.com",
    );
    expect(normalizeBaseDomain(".status.example.com.")).toBe(
      "status.example.com",
    );
  });
});

describe("getStatusPageHost / getStatusPageUrl", () => {
  it("default base domain is unchanged", () => {
    expect(getStatusPageHost("acme")).toBe("acme.openstatus.dev");
    expect(getStatusPageUrl({ slug: "acme", customDomain: "" })).toBe(
      "https://acme.openstatus.dev",
    );
  });

  it("uses the configured base domain", () => {
    expect(getStatusPageHost("acme", "status.example.com")).toBe(
      "acme.status.example.com",
    );
    expect(
      getStatusPageUrl(
        { slug: "acme", customDomain: null },
        "status.example.com",
      ),
    ).toBe("https://acme.status.example.com");
  });

  it("a custom domain wins", () => {
    expect(
      getStatusPageUrl(
        { slug: "acme", customDomain: "status.acme.com" },
        "status.example.com",
      ),
    ).toBe("https://status.acme.com");
  });
});
