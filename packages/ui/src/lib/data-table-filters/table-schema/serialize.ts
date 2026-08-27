import { createColBuilder, defaultDisplayForKind } from "./col";
import type {
  ColKind,
  ColumnDescriptor,
  DisplayDescriptor,
  FilterDescriptor,
  Provenance,
  SchemaJSON,
  SchemaJSONVersion,
  SheetDescriptor,
  TableSchemaDefinition,
} from "./types";

/** The current `SchemaJSON` version. Bump alongside a `migrateSchemaJSON` step. */
export const SCHEMA_JSON_VERSION: SchemaJSONVersion = 1;

// ── Serialization ───────────────────────────────────────────────────────────
//
// The descriptor IS the serializable state, so serialization is a rename of the
// key and nothing else. There is no projection to keep in sync, which is why
// `unit`, `presets`, and `resizable` can no longer be silently dropped.

export function serializeSchema(definition: TableSchemaDefinition): SchemaJSON {
  return {
    version: SCHEMA_JSON_VERSION,
    columns: Object.entries(definition).map(([key, builder]) => ({
      key,
      ...builder._descriptor,
    })),
  };
}

// ── Deserialization ─────────────────────────────────────────────────────────
//
// Descriptors are stored verbatim, so reconstruction hands the descriptor
// straight back to the builder. The old ~40-branch replay of the fluent chain
// — including the `enableHiding === false && hidden ⇒ .sheetOnly()` inference
// archaeology — is gone.
//
// Limitation, unchanged: renderers (display cell, filter component, sheet
// component/condition) are closures and cannot be serialized. A deserialized
// column falls back to its descriptor's display, which is why the descriptor
// keeps a real display type even when a custom renderer was supplied.

export function deserializeSchema(json: SchemaJSON): TableSchemaDefinition {
  const definition: TableSchemaDefinition = {};
  for (const { key, ...descriptor } of json.columns) {
    definition[key] = createColBuilder(descriptor as ColumnDescriptor, {});
  }
  return definition;
}

// ── Migration ───────────────────────────────────────────────────────────────

const COL_KINDS: readonly ColKind[] = [
  "string",
  "number",
  "boolean",
  "timestamp",
  "enum",
  "array",
  "record",
  "select",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asKind(value: unknown, key: unknown): ColKind {
  if (COL_KINDS.includes(value as ColKind)) return value as ColKind;
  // Falling back is better than throwing — one bad column should not make a
  // whole saved schema unloadable — but it is a real loss, so say so.
  if (value !== undefined) {
    console.warn(
      `[migrateSchemaJSON] Column ${JSON.stringify(key)} has unknown kind ` +
        `${JSON.stringify(value)}. Falling back to "string".`,
    );
  }
  return "string";
}

/**
 * Normalize an array column's item descriptor.
 *
 * v1 nests a full `ColumnDescriptor`; v0 carried only `{ dataType, enumValues }`
 * under `arrayItemType` — and, for non-enum items, nothing at all, which is
 * exactly how `string[]` columns used to collapse into `string` columns.
 */
function normalizeArrayItem(raw: unknown): ColumnDescriptor {
  const { key: _key, ...item } = normalizeColumn(raw);
  return item as ColumnDescriptor;
}

function isProvenance(value: unknown): value is Provenance {
  if (!isRecord(value)) return false;
  return (
    value.source === "manual" ||
    (value.source === "preset" &&
      typeof value.preset === "string" &&
      Array.isArray(value.args)) ||
    (value.source === "inferred" && typeof value.rule === "string")
  );
}

/**
 * Normalize one column from either version into a complete `ColumnDescriptor`.
 *
 * v1 payloads go through this too rather than being trusted: `fromJSON` accepts
 * user-typed text, so "it says version 1" is not evidence that its columns are
 * well-formed. Every required field is filled or defaulted here, which is what
 * makes the unchecked `as SchemaJSON` cast on untrusted input unnecessary.
 */
function normalizeColumn(raw: unknown): ColumnDescriptor & { key: string } {
  const c = isRecord(raw) ? raw : {};
  // v1 writes `kind`; v0 wrote `dataType`.
  const kind = asKind(c.kind ?? c.dataType, c.key);

  // v0 wrote `{ type: "text" }` for custom displays and omitted `unit`,
  // `presets`, and `resizable` entirely. Nothing can recover those — the
  // migration fills the type-required defaults and stops there.
  const display = isRecord(c.display)
    ? (c.display as DisplayDescriptor)
    : defaultDisplayForKind(kind);

  // Carried through wholesale, like `display` and `sheet`. Whitelisting the
  // optional fields here would reintroduce exactly the hand-maintained
  // projection this split removed from `serializeSchema` — a new
  // `FilterDescriptor` field would be dropped on migration and nothing would
  // say so. Only the three required fields are coerced, because they must exist.
  const filter: FilterDescriptor | null = isRecord(c.filter)
    ? {
        ...(c.filter as Partial<FilterDescriptor>),
        type: (c.filter.type ?? "input") as FilterDescriptor["type"],
        defaultOpen: c.filter.defaultOpen === true,
        commandDisabled: c.filter.commandDisabled === true,
      }
    : null;

  const sheet: SheetDescriptor | null = isRecord(c.sheet)
    ? (c.sheet as SheetDescriptor)
    : null;

  const common = {
    label: typeof c.label === "string" ? c.label : "",
    ...(typeof c.description === "string"
      ? { description: c.description }
      : {}),
    optional: c.optional === true,
    display,
    ...(typeof c.size === "number" ? { size: c.size } : {}),
    hidden: c.hidden === true,
    enableHiding: c.enableHiding !== false,
    hideHeader: c.hideHeader === true,
    // v0 had no `resizable` at all, so it defaults to false there; v1 writes it.
    resizable: c.resizable === true,
    sortable: c.sortable === true,
    filter,
    sheet,
    provenance: (isProvenance(c.provenance)
      ? c.provenance
      : { source: "manual" }) as Provenance,
  };

  const key = typeof c.key === "string" ? c.key : "";

  if (kind === "enum") {
    return {
      key,
      ...common,
      kind: "enum",
      enumValues: Array.isArray(c.enumValues) ? (c.enumValues as string[]) : [],
    };
  }
  if (kind === "array") {
    return {
      key,
      ...common,
      kind: "array",
      // v1 nests a full descriptor under `arrayItem`; v0 carried only
      // `{ dataType, enumValues }` under `arrayItemType`.
      arrayItem: normalizeArrayItem(c.arrayItem ?? c.arrayItemType),
    };
  }
  return { key, ...common, kind } as ColumnDescriptor & { key: string };
}

/**
 * Bring untrusted schema JSON up to the current version.
 *
 * `SchemaJSON` is persisted (the builder cache) and pasted by hand into the
 * schema editor, so every entry point that accepts it must run through here
 * first. This is the one hand-written conversion the descriptor split
 * deliberately keeps.
 *
 * v0 (no `version` field) → v1: `dataType` → `kind`, `arrayItemType` →
 * recursive `arrayItem`, and the newly-required `resizable`, `enableHiding`,
 * `hideHeader`, and `provenance` get their defaults.
 *
 * @throws if `json` is not an object with a `columns` array.
 */
export function migrateSchemaJSON(json: unknown): SchemaJSON {
  if (!isRecord(json) || !Array.isArray(json.columns)) {
    throw new Error(
      "[migrateSchemaJSON] Expected an object with a `columns` array.",
    );
  }

  if (json.version !== undefined && json.version !== SCHEMA_JSON_VERSION) {
    throw new Error(
      `[migrateSchemaJSON] Unknown schema version ${JSON.stringify(json.version)}. ` +
        `This build understands version ${SCHEMA_JSON_VERSION}.`,
    );
  }

  return {
    version: SCHEMA_JSON_VERSION,
    columns: json.columns.map(normalizeColumn),
  };
}
