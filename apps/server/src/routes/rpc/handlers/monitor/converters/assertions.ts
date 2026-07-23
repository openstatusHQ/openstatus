import { getLogger } from "@logtape/logtape";
import {
  type Assertion,
  deserialize,
  headerAssertion,
  recordAssertion,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import type {
  BodyAssertion,
  HeaderAssertion,
  RecordAssertion,
  StatusCodeAssertion,
} from "@openstatus/proto/monitor/v1";

import {
  compareToNumberComparator,
  compareToRecordComparator,
  compareToStringComparator,
  numberComparatorToString,
  recordComparatorToString,
  stringComparatorToString,
} from "./comparators";

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
// Proto to DB (for writes)
// ============================================================

/**
 * Convert HTTP monitor proto assertions to database JSON string.
 * Uses @openstatus/assertions package format.
 */
export function httpAssertionsToDbJson(
  statusCodeAssertions: StatusCodeAssertion[],
  bodyAssertions: BodyAssertion[],
  headerAssertions: HeaderAssertion[],
): string | undefined {
  const schemas: Array<Record<string, unknown>> = [];

  for (const s of statusCodeAssertions) {
    schemas.push({
      version: "v1",
      type: "status",
      compare: numberComparatorToString(s.comparator),
      target: Number(s.target),
    });
  }

  for (const b of bodyAssertions) {
    schemas.push({
      version: "v1",
      type: "textBody",
      compare: stringComparatorToString(b.comparator),
      target: b.target,
    });
  }

  for (const h of headerAssertions) {
    schemas.push({
      version: "v1",
      type: "header",
      compare: stringComparatorToString(h.comparator),
      target: h.target,
      key: h.key,
    });
  }

  return schemas.length > 0 ? JSON.stringify(schemas) : undefined;
}

/**
 * Convert DNS monitor proto assertions to database JSON string.
 * Uses @openstatus/assertions package format with dnsRecord type.
 */
export function dnsAssertionsToDbJson(
  recordAssertions: RecordAssertion[],
): string | undefined {
  if (recordAssertions.length === 0) {
    return undefined;
  }

  const schemas = recordAssertions.map((a) => ({
    version: "v1",
    type: "dnsRecord",
    compare: recordComparatorToString(a.comparator),
    target: a.target,
    key: a.record,
  }));

  return JSON.stringify(schemas);
}
