import { getLogger } from "@logtape/logtape";
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
// Types for DB assertions
// ============================================================

interface DbAssertion {
  type: string;
  compare: string;
  target: string | number;
  key?: string;
  record?: string;
}

// ============================================================
// DB to Proto (for reads)
// ============================================================

export interface HttpAssertions {
  statusCodeAssertions: StatusCodeAssertion[];
  bodyAssertions: BodyAssertion[];
  headerAssertions: HeaderAssertion[];
}

/**
 * Parse database assertions JSON for HTTP monitors.
 */
export function parseHttpAssertions(assertionsJson: string | null): HttpAssertions {
  const result: HttpAssertions = {
    statusCodeAssertions: [],
    bodyAssertions: [],
    headerAssertions: [],
  };

  if (!assertionsJson) {
    return result;
  }

  try {
    const assertions = JSON.parse(assertionsJson) as DbAssertion[];

    for (const a of assertions) {
      switch (a.type) {
        case "status":
          result.statusCodeAssertions.push({
            $typeName: "openstatus.monitor.v1.StatusCodeAssertion",
            target: BigInt(a.target),
            comparator: compareToNumberComparator(a.compare),
          });
          break;
        case "textBody":
        case "jsonBody":
          result.bodyAssertions.push({
            $typeName: "openstatus.monitor.v1.BodyAssertion",
            target: String(a.target),
            comparator: compareToStringComparator(a.compare),
          });
          break;
        case "header":
          result.headerAssertions.push({
            $typeName: "openstatus.monitor.v1.HeaderAssertion",
            target: String(a.target),
            comparator: compareToStringComparator(a.compare),
            key: a.key ?? "",
          });
          break;
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
 * Parse database assertions JSON for DNS monitors.
 */
export function parseDnsAssertions(assertionsJson: string | null): RecordAssertion[] {
  if (!assertionsJson) {
    return [];
  }

  try {
    const assertions = JSON.parse(assertionsJson) as DbAssertion[];

    return assertions
      .filter((a) => a.type === "dns" || a.record)
      .map((a) => ({
        $typeName: "openstatus.monitor.v1.RecordAssertion" as const,
        record: a.record ?? "",
        target: String(a.target),
        comparator: compareToRecordComparator(a.compare),
      }));
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
 */
export function httpAssertionsToDbJson(
  statusCodeAssertions: StatusCodeAssertion[],
  bodyAssertions: BodyAssertion[],
  headerAssertions: HeaderAssertion[],
): string | undefined {
  const assertions: DbAssertion[] = [];

  for (const s of statusCodeAssertions) {
    assertions.push({
      type: "status",
      compare: numberComparatorToString(s.comparator),
      target: Number(s.target),
    });
  }

  for (const b of bodyAssertions) {
    assertions.push({
      type: "textBody",
      compare: stringComparatorToString(b.comparator),
      target: b.target,
    });
  }

  for (const h of headerAssertions) {
    assertions.push({
      type: "header",
      compare: stringComparatorToString(h.comparator),
      target: h.target,
      key: h.key,
    });
  }

  return assertions.length > 0 ? JSON.stringify(assertions) : undefined;
}

/**
 * Convert DNS monitor proto assertions to database JSON string.
 */
export function dnsAssertionsToDbJson(
  recordAssertions: RecordAssertion[],
): string | undefined {
  if (recordAssertions.length === 0) {
    return undefined;
  }

  const assertions = recordAssertions.map((a) => ({
    type: "dns",
    compare: recordComparatorToString(a.comparator),
    target: a.target,
    record: a.record,
  }));

  return JSON.stringify(assertions);
}
