import { z } from "zod";

// Flat shape + cross-field `.refine` for the monitor/static invariant.
// The DB has a matching CHECK constraint
// (`type='monitor' AND monitor_id IS NOT NULL OR type='static' AND
// monitor_id IS NULL`); catching it at parse time produces a clean
// `ZodError` instead of letting it surface as an opaque SQLite CHECK
// failure. A `z.discriminatedUnion` would express the same invariant
// more precisely in the type system, but react-hook-form (used by the
// dashboard forms that submit this shape) doesn't model discriminated
// unions cleanly — every caller would need a flat→union adapter.
// `.refine` keeps the inferred TS shape flat so callers can use their
// existing RHF schemas unchanged and we still get the service-level
// parse error when the invariant is violated.
const componentInput = z
  .object({
    id: z.number().int().optional(),
    monitorId: z.number().int().nullish(),
    externalServiceId: z.number().int().nullish(),
    externalServiceComponentId: z.number().int().nullish(),
    order: z.number().int(),
    name: z.string(),
    description: z.string().nullish(),
    type: z.enum(["monitor", "static", "external"]),
  })
  .refine(
    (c) => {
      switch (c.type) {
        case "monitor":
          return (
            c.monitorId != null &&
            c.externalServiceId == null &&
            c.externalServiceComponentId == null
          );
        case "static":
          return (
            c.monitorId == null &&
            c.externalServiceId == null &&
            c.externalServiceComponentId == null
          );
        case "external":
          return c.monitorId == null && c.externalServiceId != null;
        default:
          return false;
      }
    },
    {
      path: ["type"],
      message:
        "monitor requires monitorId; static requires no refs; external requires externalServiceId.",
    },
  );

const groupInput = z.object({
  // `id` is required to round-trip existing groups. Omitting it flags the
  // group as new → gets INSERTed and a fresh id. Without this, every
  // reorder deletes and recreates groups, cascading their FKs (component
  // assignments, subscriber scopes) off a cliff.
  id: z.number().int().optional(),
  order: z.number().int(),
  name: z.string(),
  defaultOpen: z.boolean().optional().default(false),
  components: z.array(componentInput),
});

export const ListPageComponentsInput = z.object({
  pageId: z.number().int().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});
export type ListPageComponentsInput = z.infer<typeof ListPageComponentsInput>;

export const DeletePageComponentInput = z.object({
  id: z.number().int(),
});
export type DeletePageComponentInput = z.infer<typeof DeletePageComponentInput>;

export const UpdatePageComponentOrderInput = z.object({
  pageId: z.number().int(),
  components: z.array(componentInput),
  groups: z.array(groupInput),
});
export type UpdatePageComponentOrderInput = z.infer<
  typeof UpdatePageComponentOrderInput
>;

export const GetPageComponentDailySummaryInput = z.object({
  pageId: z.number().int(),
  workspaceId: z.number().int(),
  componentIds: z.array(z.number().int()).optional(),
  days: z.number().int().min(1).max(45).optional(),
});
export type GetPageComponentDailySummaryInput = z.infer<
  typeof GetPageComponentDailySummaryInput
>;
