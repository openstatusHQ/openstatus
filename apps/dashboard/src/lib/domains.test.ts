import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { extractDomain, getApexDomain, getSubdomain } from "./domains";

let errorStub: MockInstance | undefined;
beforeEach(() => {
  errorStub = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined as never);
});
afterEach(() => errorStub?.mockRestore());

describe("getSubdomain", () => {
  it("returns null for the apex itself", () => {
    expect(getSubdomain("openstatus.dev", "openstatus.dev")).toBeNull();
  });

  it("strips the apex and its dot", () => {
    expect(getSubdomain("status.openstatus.dev", "openstatus.dev")).toBe(
      "status",
    );
    expect(getSubdomain("a.b.openstatus.dev", "openstatus.dev")).toBe("a.b");
  });
});

describe("getApexDomain", () => {
  it("keeps a two-label hostname", () => {
    expect(getApexDomain("https://openstatus.dev/pricing")).toBe(
      "openstatus.dev",
    );
  });

  it("drops subdomains", () => {
    expect(getApexDomain("https://status.app.openstatus.dev")).toBe(
      "openstatus.dev",
    );
  });

  it("returns an empty string for an invalid URL", () => {
    expect(getApexDomain("not a url")).toBe("");
  });
});

describe("extractDomain", () => {
  it("returns the label of a bare domain", () => {
    expect(extractDomain("https://mxkaske.dev")).toBe("mxkaske");
  });

  it("joins subdomains with dashes", () => {
    expect(extractDomain("https://craft.mxkaske.dev")).toBe("craft-mxkaske");
    expect(extractDomain("https://a.b.mxkaske.dev")).toBe("a-b-mxkaske");
  });

  it("returns an empty string for single-label hosts", () => {
    expect(extractDomain("http://localhost:3000")).toBe("");
  });

  it("returns an empty string for blank or invalid input", () => {
    expect(extractDomain("   ")).toBe("");
    expect(extractDomain("craft.mxkaske.dev")).toBe("");
  });
});
