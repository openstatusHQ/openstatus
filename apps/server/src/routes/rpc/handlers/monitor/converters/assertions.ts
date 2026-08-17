import { Code, ConnectError } from "@connectrpc/connect";
import { getLogger } from "@logtape/logtape";
import {
  type Assertion,
  deserialize,
  dnsRecords,
  headerAssertion,
  type numberCompare,
  recordAssertion,
  type recordCompare,
  statusAssertion,
  type stringCompare,
  textBodyAssertion,
} from "@openstatus/assertions";
import type {
  BodyAssertion,
  HeaderAssertion,
  RecordAssertion,
  StatusCodeAssertion,
} from "@openstatus/proto/monitor/v1";
import type { z } from "zod";

import {
  compareToNumberComparator,
  compareToRecordComparator,
  compareToStringComparator,
  numberComparatorToString,
  recordComparatorToString,
  stringComparatorToString,
} from "./comparators";

type NumberCompare = z.infer<typeof numberCompare>;
type StringCompare = z.infer<typeof stringCompare>;
type RecordCompare = z.infer<typeof recordCompare>;
type DnsRecord = (typeof dnsRecords)[number];

const logger = getLogger("api-server");

// ============================================================
// DB to Proto (for reads)
// ============================================================

export interface HttpAssertions {
  statusCodeAssertions: StatusCodeAssertion[];
  bodyAssertions: BodyAssertion[];
  headerAssertions: HeaderAssertion[];
}

/**
 * Parse database assertions JSON for HTTP monitors using @openstatus/assertions package.
 */
export function parseHttpAssertions(
  assertionsJson: string | null,
): HttpAssertions {
  const result: HttpAssertions = {
    statusCodeAssertions: [],
    bodyAssertions: [],
    headerAssertions: [],
  };

  if (!assertionsJson) {
    return result;
  }

  try {
    const assertions = deserialize(assertionsJson);

    for (const a of assertions) {
      const schema = a.schema;

      switch (schema.type) {
        case "status": {
          const parsed = statusAssertion.parse(schema);
          result.statusCodeAssertions.push({
            $typeName: "openstatus.monitor.v1.StatusCodeAssertion",
            target: BigInt(parsed.target),
            comparator: compareToNumberComparator(parsed.compare),
          });
          break;
        }
        case "textBody":
        case "jsonBody": {
          const parsed = textBodyAssertion.parse(schema);
          result.bodyAssertions.push({
            $typeName: "openstatus.monitor.v1.BodyAssertion",
            target: parsed.target,
            comparator: compareToStringComparator(parsed.compare),
          });
          break;
        }
        case "header": {
          const parsed = headerAssertion.parse(schema);
          result.headerAssertions.push({
            $typeName: "openstatus.monitor.v1.HeaderAssertion",
            target: parsed.target,
            comparator: compareToStringComparator(parsed.compare),
            key: parsed.key,
          });
          break;
        }
      }
    }
  } catch (error) {
    logger.error("Failed to parse HTTP assertions JSON", {
      error: error instanceof Error ? error.message : String(error),
      assertions_json: assertionsJson,
    });
  }

  return result;
}

/**
 * Parse database assertions JSON for DNS monitors using @openstatus/assertions package.
 */
export function parseDnsAssertions(
  assertionsJson: string | null,
): RecordAssertion[] {
  if (!assertionsJson) {
    return [];
  }

  try {
    // Normalize legacy DNS format before deserializing
    const assertions = deserialize(assertionsJson);

    return assertions
      .filter(
        (a): a is Assertion & { schema: { type: "dnsRecord" } } =>
          a.schema.type === "dnsRecord",
      )
      .map((a) => {
        const parsed = recordAssertion.parse(a.schema);
        return {
          $typeName: "openstatus.monitor.v1.RecordAssertion" as const,
          record: parsed.key,
          target: parsed.target,
          comparator: compareToRecordComparator(parsed.compare),
        };
      });
  } catch (error) {
    logger.error("Failed to parse DNS assertions JSON", {
      error: error instanceof Error ? error.message : String(error),
      assertions_json: assertionsJson,
    });
    return [];
  }
}

// ============================================================
// Proto to service input (for writes)
// ============================================================

/** The service layer's assertion input — serialising is its job, not ours. */
export type MonitorAssertionInput =
  | { version: "v1"; type: "status"; compare: NumberCompare; target: number }
  | { version: "v1"; type: "textBody"; compare: StringCompare; target: string }
  | {
      version: "v1";
      type: "header";
      compare: StringCompare;
      target: string;
      key: string;
    }
  | {
      version: "v1";
      type: "dnsRecord";
      compare: RecordCompare;
      target: string;
      key: DnsRecord;
    };

/**
 * Narrow the proto's free-string record type to the assertion enum.
 * protovalidate already restricts the field, so a miss here means the
 * validation interceptor was bypassed.
 */
function toDnsRecordKey(record: string): DnsRecord {
  const match = dnsRecords.find((r) => r === record);
  if (!match) {
    throw new ConnectError(
      `Invalid DNS record type: ${record}`,
      Code.InvalidArgument,
    );
  }
  return match;
}

export function protoHttpAssertionsToService(
  statusCodeAssertions: StatusCodeAssertion[],
  bodyAssertions: BodyAssertion[],
  headerAssertions: HeaderAssertion[],
): MonitorAssertionInput[] {
  return [
    ...statusCodeAssertions.map(
      (s) =>
        ({
          version: "v1",
          type: "status",
          compare: numberComparatorToString(s.comparator),
          target: Number(s.target),
        }) as const,
    ),
    ...bodyAssertions.map(
      (b) =>
        ({
          version: "v1",
          type: "textBody",
          compare: stringComparatorToString(b.comparator),
          target: b.target,
        }) as const,
    ),
    ...headerAssertions.map(
      (h) =>
        ({
          version: "v1",
          type: "header",
          compare: stringComparatorToString(h.comparator),
          target: h.target,
          key: h.key,
        }) as const,
    ),
  ];
}

export function protoDnsAssertionsToService(
  recordAssertions: RecordAssertion[],
): MonitorAssertionInput[] {
  return recordAssertions.map(
    (a) =>
      ({
        version: "v1",
        type: "dnsRecord",
        compare: recordComparatorToString(a.comparator),
        target: a.target,
        key: toDnsRecordKey(a.record),
      }) as const,
  );
}
