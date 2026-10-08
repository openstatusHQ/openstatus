import { assertion } from "@openstatus/assertions";
import {
  type BodyAssertion,
  type HeaderAssertion,
  NumberComparator,
  type RecordAssertion,
  RecordComparator,
  type StatusCodeAssertion,
  StringComparator,
} from "@openstatus/proto/monitor/v1";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { z } from "zod";

import {
  type MonitorAssertionInput,
  parseDnsAssertions,
  parseHttpAssertions,
  protoDnsAssertionsToService,
  protoHttpAssertionsToService,
} from "./assertions";

/**
 * Mirrors what the service stores: `serialize()` is
 * `JSON.stringify(assertions.map((a) => a.schema))`, and the schemas are
 * exactly what the converters emit. Inlined so the test doesn't have to
 * build throwaway `Assertion` class instances just to unwrap them again.
 */
function store(input: MonitorAssertionInput[]): string {
  return JSON.stringify(z.array(assertion).parse(input));
}

function statusAssertion(
  target: number,
  comparator: NumberComparator,
): StatusCodeAssertion {
  return {
    $typeName: "openstatus.monitor.v1.StatusCodeAssertion",
    target: BigInt(target),
    comparator,
  };
}

function bodyAssertion(
  target: string,
  comparator: StringComparator,
): BodyAssertion {
  return {
    $typeName: "openstatus.monitor.v1.BodyAssertion",
    target,
    comparator,
  };
}

function headerAssertion(
  key: string,
  target: string,
  comparator: StringComparator,
): HeaderAssertion {
  return {
    $typeName: "openstatus.monitor.v1.HeaderAssertion",
    key,
    target,
    comparator,
  };
}

function recordAssertion(
  record: string,
  target: string,
  comparator: RecordComparator,
): RecordAssertion {
  return {
    $typeName: "openstatus.monitor.v1.RecordAssertion",
    record,
    target,
    comparator,
  };
}

describe("protoHttpAssertionsToService", () => {
  test("returns an empty list when nothing is asserted", () => {
    expect(protoHttpAssertionsToService([], [], [])).toEqual([]);
  });

  test("converts each assertion kind", () => {
    const result = protoHttpAssertionsToService(
      [statusAssertion(200, NumberComparator.EQUAL)],
      [bodyAssertion("ok", StringComparator.CONTAINS)],
      [headerAssertion("content-type", "json", StringComparator.NOT_EQUAL)],
    );

    expect(result).toEqual([
      { version: "v1", type: "status", compare: "eq", target: 200 },
      { version: "v1", type: "textBody", compare: "contains", target: "ok" },
      {
        version: "v1",
        type: "header",
        compare: "not_eq",
        target: "json",
        key: "content-type",
      },
    ]);
  });

  test("output is accepted by the service's assertion schema", () => {
    // The contract that matters: whatever this emits must survive
    // `CreateMonitorInput`'s parse, or every create 400s at the service.
    const result = protoHttpAssertionsToService(
      [
        statusAssertion(200, NumberComparator.EQUAL),
        statusAssertion(500, NumberComparator.LESS_THAN),
      ],
      [bodyAssertion("healthy", StringComparator.NOT_CONTAINS)],
      [headerAssertion("x-cache", "HIT", StringComparator.EQUAL)],
    );

    expect(() => z.array(assertion).parse(result)).not.toThrow();
  });

  test("survives a full round-trip back to proto", () => {
    const status = statusAssertion(201, NumberComparator.GREATER_THAN_OR_EQUAL);
    const body = bodyAssertion("pong", StringComparator.EQUAL);
    const header = headerAssertion("etag", "abc", StringComparator.CONTAINS);

    const stored = store(
      protoHttpAssertionsToService([status], [body], [header]),
    );
    const back = parseHttpAssertions(stored);

    expect(back.statusCodeAssertions[0]?.target).toBe(BigInt(201));
    expect(back.statusCodeAssertions[0]?.comparator).toBe(
      NumberComparator.GREATER_THAN_OR_EQUAL,
    );
    expect(back.bodyAssertions[0]?.target).toBe("pong");
    expect(back.headerAssertions[0]?.key).toBe("etag");
    expect(back.headerAssertions[0]?.comparator).toBe(
      StringComparator.CONTAINS,
    );
  });

  test("an unspecified comparator falls back to eq", () => {
    const result = protoHttpAssertionsToService(
      [statusAssertion(200, NumberComparator.UNSPECIFIED)],
      [],
      [],
    );
    expect(result[0]).toMatchObject({ compare: "eq" });
  });
});

describe("protoDnsAssertionsToService", () => {
  test("returns an empty list when nothing is asserted", () => {
    expect(protoDnsAssertionsToService([])).toEqual([]);
  });

  test("maps the record type onto the assertion key", () => {
    const result = protoDnsAssertionsToService([
      recordAssertion("CNAME", "example.com", RecordComparator.EQUAL),
    ]);

    expect(result).toEqual([
      {
        version: "v1",
        type: "dnsRecord",
        compare: "eq",
        target: "example.com",
        key: "CNAME",
      },
    ]);
  });

  test("output is accepted by the service's assertion schema", () => {
    const result = protoDnsAssertionsToService([
      recordAssertion("A", "1.2.3.4", RecordComparator.NOT_CONTAINS),
      recordAssertion("TXT", "v=spf1", RecordComparator.CONTAINS),
    ]);

    expect(() => z.array(assertion).parse(result)).not.toThrow();
  });

  test("survives a full round-trip back to proto", () => {
    const stored = store(
      protoDnsAssertionsToService([
        recordAssertion("MX", "mail.example.com", RecordComparator.EQUAL),
      ]),
    );
    const back = parseDnsAssertions(stored);

    expect(back[0]?.record).toBe("MX");
    expect(back[0]?.target).toBe("mail.example.com");
    expect(back[0]?.comparator).toBe(RecordComparator.EQUAL);
  });

  test("rejects a record type outside the assertion enum", () => {
    // protovalidate should have caught this upstream; if it didn't, fail
    // loudly rather than writing an unparseable row.
    expect(() =>
      protoDnsAssertionsToService([
        recordAssertion("SRV", "x", RecordComparator.EQUAL),
      ]),
    ).toThrow();
  });
});
