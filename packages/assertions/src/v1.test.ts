import assert from "node:assert/strict";
import { test } from "node:test";

import { deserialize } from "./index";

for (const { name, header, key, compare, target, success } of [
  {
    name: "matches a lowercase assertion to a canonical header",
    header: { "Content-Type": "application/json" },
    key: "content-type",
    compare: "eq",
    target: "application/json",
    success: true,
  },
  {
    name: "matches a mixed-case assertion to a lowercase header",
    header: { "content-type": "application/json" },
    key: "CoNtEnT-TyPe",
    compare: "eq",
    target: "application/json",
    success: true,
  },
  {
    name: "keeps header value comparisons case-sensitive",
    header: { "Content-Type": "application/JSON" },
    key: "content-type",
    compare: "eq",
    target: "application/json",
    success: false,
  },
  {
    name: "compares the actual header value for negative assertions",
    header: { "Content-Type": "application/json" },
    key: "content-type",
    compare: "not_eq",
    target: "application/json",
    success: false,
  },
  {
    name: "does not read an inherited constructor header",
    header: {},
    key: "constructor",
    compare: "contains",
    target: "Object",
    success: false,
  },
  {
    name: "reads an own constructor header",
    header: { constructor: "present" },
    key: "CONSTRUCTOR",
    compare: "eq",
    target: "present",
    success: true,
  },
  {
    name: "keeps the empty-string fallback for a missing header",
    header: {},
    key: "x-missing",
    compare: "empty",
    target: "",
    success: true,
  },
]) {
  test(name, () => {
    const assertions = deserialize(
      JSON.stringify([{ version: "v1", type: "header", key, compare, target }]),
    );
    const results = assertions.map((assertion) =>
      assertion.assert({ body: "", header, status: 200 }),
    );
    assert.deepEqual(
      results.map((result) => result.success),
      [success],
    );
  });
}
