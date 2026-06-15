import { describe, expect, it } from "bun:test";

import { JsonBodyAssertion } from "./v1";

const request = (body: unknown) => ({
  body: JSON.stringify(body),
  header: {},
  status: 200,
});

describe("JsonBodyAssertion", () => {
  it("passes eq when the JSONPath value equals the target", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.name",
      compare: "eq",
      target: "openstatus",
    });

    expect(assertion.assert(request({ name: "openstatus" }))).toEqual({
      success: true,
    });
  });

  it("fails eq when the JSONPath value differs from the target", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.name",
      compare: "eq",
      target: "openstatus",
    });

    expect(assertion.assert(request({ name: "other" })).success).toBe(false);
  });

  it("fails not_eq when the JSONPath value equals the target", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.name",
      compare: "not_eq",
      target: "openstatus",
    });

    expect(assertion.assert(request({ name: "openstatus" })).success).toBe(
      false,
    );
  });

  it("treats contains as substring match, not array membership", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.name",
      compare: "contains",
      target: "status",
    });

    expect(assertion.assert(request({ name: "openstatus" }))).toEqual({
      success: true,
    });
  });

  it("compares numeric JSON values via their string form", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.count",
      compare: "eq",
      target: "5",
    });

    expect(assertion.assert(request({ count: 5 }))).toEqual({ success: true });
  });

  it("fails eq when the JSONPath matches nothing", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.missing",
      compare: "eq",
      target: "openstatus",
    });

    expect(assertion.assert(request({ name: "openstatus" })).success).toBe(
      false,
    );
  });

  it("passes not_eq when the JSONPath matches nothing", () => {
    const assertion = new JsonBodyAssertion({
      version: "v1",
      type: "jsonBody",
      path: "$.missing",
      compare: "not_eq",
      target: "openstatus",
    });

    expect(assertion.assert(request({ name: "openstatus" }))).toEqual({
      success: true,
    });
  });
});
