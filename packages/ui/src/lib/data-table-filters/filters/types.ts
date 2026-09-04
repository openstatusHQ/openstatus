import type { ColKind, FilterType } from "../table-schema/types";

export type { ColKind, FilterType };

/** A value a filter can compare against. */
export type Scalar = string | number | boolean;

/**
 * A column's declared filter semantics, flattened to plain data.
 *
 * This is the whole input to the normalization table. Backends never see
 * anything else about a column, which is what stops them re-deriving semantics
 * from the runtime shape of a value.
 */
export type FilterSpec = {
  /** Dot-notation — the ONE identity space, matching the table schema key. */
  key: string;
  type: FilterType;
  kind: ColKind;
  /** Present when `kind === "array"`. */
  itemKind?: ColKind;
  options?: readonly Scalar[];
  min?: number;
  max?: number;
};

/**
 * The canonical, backend-neutral operation set.
 *
 * CLOSED union — exactly six members. Every backend implements all six with an
 * exhaustive switch and no default branch, so adding a seventh is a compile
 * error at every backend rather than a silent fallthrough. That is the point of
 * the design, not a defect: a new op is a breaking change to every engine.
 */
export type FilterOp =
  /** Case-insensitive substring match. */
  | { op: "substring"; key: string; value: string }
  | { op: "equals"; key: string; value: Scalar }
  /** Scalar column, value ∈ set. */
  | { op: "oneOf"; key: string; values: Scalar[] }
  /** Array column, column ∩ set ≠ ∅. */
  | { op: "overlaps"; key: string; values: Scalar[] }
  /** Inclusive on both ends. */
  | { op: "numberRange"; key: string; min: number; max: number }
  /** Inclusive on both ends. */
  | { op: "dateRange"; key: string; from: Date; to: Date };

/** Restrict which keys `plan` / `matches` consider. */
export type FilterSelection = {
  only?: readonly string[];
  exclude?: readonly string[];
};
