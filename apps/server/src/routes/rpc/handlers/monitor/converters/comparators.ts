import {
  NumberComparator,
  RecordComparator,
  StringComparator,
} from "@openstatus/proto/monitor/v1";

// ============================================================
// DB to Proto (for reads)
// ============================================================

const DB_TO_NUMBER_COMPARATOR: Record<string, NumberComparator> = {
  eq: NumberComparator.EQUAL,
  not_eq: NumberComparator.NOT_EQUAL,
  gt: NumberComparator.GREATER_THAN,
  gte: NumberComparator.GREATER_THAN_OR_EQUAL,
  lt: NumberComparator.LESS_THAN,
  lte: NumberComparator.LESS_THAN_OR_EQUAL,
};

const DB_TO_STRING_COMPARATOR: Record<string, StringComparator> = {
  eq: StringComparator.EQUAL,
  not_eq: StringComparator.NOT_EQUAL,
  contains: StringComparator.CONTAINS,
  not_contains: StringComparator.NOT_CONTAINS,
  empty: StringComparator.EMPTY,
  not_empty: StringComparator.NOT_EMPTY,
  gt: StringComparator.GREATER_THAN,
  gte: StringComparator.GREATER_THAN_OR_EQUAL,
  lt: StringComparator.LESS_THAN,
  lte: StringComparator.LESS_THAN_OR_EQUAL,
};

const DB_TO_RECORD_COMPARATOR: Record<string, RecordComparator> = {
  eq: RecordComparator.EQUAL,
  not_eq: RecordComparator.NOT_EQUAL,
  contains: RecordComparator.CONTAINS,
  not_contains: RecordComparator.NOT_CONTAINS,
};

export function compareToNumberComparator(compare: string): NumberComparator {
  return DB_TO_NUMBER_COMPARATOR[compare] ?? NumberComparator.UNSPECIFIED;
}

export function compareToStringComparator(compare: string): StringComparator {
  return DB_TO_STRING_COMPARATOR[compare] ?? StringComparator.UNSPECIFIED;
}

export function compareToRecordComparator(compare: string): RecordComparator {
  return DB_TO_RECORD_COMPARATOR[compare] ?? RecordComparator.UNSPECIFIED;
}

// ============================================================
// Proto to DB (for writes)
// ============================================================

const NUMBER_COMPARATOR_TO_DB: Record<NumberComparator, string> = {
  [NumberComparator.EQUAL]: "eq",
  [NumberComparator.NOT_EQUAL]: "not_eq",
  [NumberComparator.GREATER_THAN]: "gt",
  [NumberComparator.GREATER_THAN_OR_EQUAL]: "gte",
  [NumberComparator.LESS_THAN]: "lt",
  [NumberComparator.LESS_THAN_OR_EQUAL]: "lte",
  [NumberComparator.UNSPECIFIED]: "eq",
};

const STRING_COMPARATOR_TO_DB: Record<StringComparator, string> = {
  [StringComparator.EQUAL]: "eq",
  [StringComparator.NOT_EQUAL]: "not_eq",
  [StringComparator.CONTAINS]: "contains",
  [StringComparator.NOT_CONTAINS]: "not_contains",
  [StringComparator.EMPTY]: "empty",
  [StringComparator.NOT_EMPTY]: "not_empty",
  [StringComparator.GREATER_THAN]: "gt",
  [StringComparator.GREATER_THAN_OR_EQUAL]: "gte",
  [StringComparator.LESS_THAN]: "lt",
  [StringComparator.LESS_THAN_OR_EQUAL]: "lte",
  [StringComparator.UNSPECIFIED]: "eq",
};

const RECORD_COMPARATOR_TO_DB: Record<RecordComparator, string> = {
  [RecordComparator.EQUAL]: "eq",
  [RecordComparator.NOT_EQUAL]: "not_eq",
  [RecordComparator.CONTAINS]: "contains",
  [RecordComparator.NOT_CONTAINS]: "not_contains",
  [RecordComparator.UNSPECIFIED]: "eq",
};

export function numberComparatorToString(comp: NumberComparator): string {
  return NUMBER_COMPARATOR_TO_DB[comp] ?? "eq";
}

export function stringComparatorToString(comp: StringComparator): string {
  return STRING_COMPARATOR_TO_DB[comp] ?? "eq";
}

export function recordComparatorToString(comp: RecordComparator): string {
  return RECORD_COMPARATOR_TO_DB[comp] ?? "eq";
}
