import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { deserialize, serialize } from "./serializing";
import {
  DnsRecordAssertion,
  HeaderAssertion,
  JsonBodyAssertion,
  StatusAssertion,
  TextBodyAssertion,
} from "./v1";

const raw = [
  { version: "v1", type: "status", compare: "eq", target: 200 },
  {
    version: "v1",
    type: "header",
    compare: "contains",
    key: "Content-Type",
    target: "json",
  },
  { version: "v1", type: "textBody", compare: "not_empty", target: "" },
  {
    version: "v1",
    type: "jsonBody",
    path: "$.status",
    compare: "contains",
    target: "ok",
  },
  {
    version: "v1",
    type: "dnsRecord",
    key: "A",
    compare: "eq",
    target: "1.1.1.1",
  },
];

describe("deserialize", () => {
  it("builds the matching class for each type", () => {
    const assertions = deserialize(JSON.stringify(raw));
    expect(assertions.map((a) => a.constructor)).toEqual([
      StatusAssertion,
      HeaderAssertion,
      TextBodyAssertion,
      JsonBodyAssertion,
      DnsRecordAssertion,
    ]);
  });

  it("fills in a missing version", () => {
    const [a] = deserialize('[{"type":"status","compare":"eq","target":200}]');
    expect(a.schema.version).toBe("v1");
  });

  it("returns nothing for an empty list", () => {
    expect(deserialize("[]")).toEqual([]);
  });

  it("throws on an unknown type", () => {
    expect(() => deserialize('[{"type":"latency"}]')).toThrow(
      "unknown assertion type: latency",
    );
  });

  it("throws when a known type has invalid fields", () => {
    expect(() =>
      deserialize('[{"type":"status","compare":"contains","target":200}]'),
    ).toThrow();
  });

  it("throws on malformed JSON", () => {
    expect(() => deserialize("not json")).toThrow();
  });
});

describe("serialize", () => {
  it("round-trips through deserialize", () => {
    const json = JSON.stringify(raw);
    expect(JSON.parse(serialize(deserialize(json)))).toEqual(raw);
  });
});
