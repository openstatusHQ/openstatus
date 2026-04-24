import { z } from "zod";

// Discriminated union on `type` — the DB has a matching CHECK
// constraint (`type='monitor' AND monitor_id IS NOT NULL OR
// type='static' AND monitor_id IS NULL`), but violating it via a
// flat schema would surface as an opaque SQLite CHECK failure.
// Catching it at parse time produces a clean `ZodError` at the right
// layer and lets the narrowed branches drop the
// `c.type === 'monitor' && c.monitorId` dead guards downstream.
const monitorComponentInput = z.object({
  id: z.number().int().optional(),
  type: z.literal("monitor"),
  monitorId: z.number().int(),
  order: z.number().int(),
  name: z.string(),
  description: z.string().nullish(),
});

const staticComponentInput = z.object({
  id: z.number().int().optional(),
  type: z.literal("static"),
  // `monitorId` intentionally absent — the CHECK constraint requires
  // `NULL` on static rows; the service writes `null` explicitly for
  // them.
  order: z.number().int(),
  name: z.string(),
  description: z.string().nullish(),
});

const componentInput = z.discriminatedUnion("type", [
  monitorComponentInput,
  staticComponentInput,
]);

const groupInput = z.object({
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
