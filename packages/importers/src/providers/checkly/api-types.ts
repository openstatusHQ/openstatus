import { z } from "zod";

/**
 * `checkType` is parsed as a free string (not an enum) so the import never
 * hard-fails when Checkly adds a new check type — the mapper decides which
 * types are runnable and skips the rest with a reason.
 */
export const ChecklyRequestHeaderSchema = z.object({
  key: z.string(),
  value: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
});

export const ChecklyRequestSchema = z.object({
  method: z
    .string()
    .nullish()
    .transform((v) => v ?? "GET"),
  url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  headers: z
    .array(ChecklyRequestHeaderSchema)
    .nullish()
    .transform((v) => v ?? []),
  body: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  bodyType: z
    .string()
    .nullish()
    .transform((v) => v ?? "NONE"),
  followRedirects: z
    .boolean()
    .nullish()
    .transform((v) => v ?? true),
});

export type ChecklyRequest = z.infer<typeof ChecklyRequestSchema>;

export const ChecklyCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  checkType: z.string(),
  // Frequency in minutes; 0 means sub-minute (see frequencyOffset).
  frequency: z
    .number()
    .nullish()
    .transform((v) => v ?? 10),
  frequencyOffset: z.number().nullish(),
  activated: z
    .boolean()
    .nullish()
    .transform((v) => v ?? true),
  muted: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  shouldFail: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  // AWS-style region codes, e.g. "us-east-1".
  locations: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  privateLocations: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  tags: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  groupId: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v != null ? String(v) : null)),
  degradedResponseTime: z.number().nullish(),
  maxResponseTime: z.number().nullish(),
  // Present on API/URL checks; other check types carry their target elsewhere.
  request: ChecklyRequestSchema.nullish(),
});

export type ChecklyCheck = z.infer<typeof ChecklyCheckSchema>;

/** A status-page service — an abstract entity; it does NOT reference a check. */
export const ChecklyServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string().nullish(),
});

export type ChecklyService = z.infer<typeof ChecklyServiceSchema>;

export const ChecklyCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  services: z
    .array(ChecklyServiceSchema)
    .nullish()
    .transform((v) => v ?? []),
});

export type ChecklyCard = z.infer<typeof ChecklyCardSchema>;

export const ChecklyStatusPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  customDomain: z.string().nullish(),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  logo: z.string().nullish(),
  favicon: z.string().nullish(),
  isPrivate: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  cards: z
    .array(ChecklyCardSchema)
    .nullish()
    .transform((v) => v ?? []),
});

export type ChecklyStatusPage = z.infer<typeof ChecklyStatusPageSchema>;

export const ChecklyIncidentUpdateSchema = z.object({
  id: z.string(),
  // Not every update carries a status; the mapper falls back per-position.
  incidentUpdateStatus: z.string().nullish(),
  status: z.string().nullish(),
  description: z.string().nullish(),
  text: z.string().nullish(),
  created_at: z.string(),
});

export type ChecklyIncidentUpdate = z.infer<typeof ChecklyIncidentUpdateSchema>;

export const ChecklyIncidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  severity: z.string().nullish(),
  // INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED
  lastUpdateStatus: z.string().nullish(),
  services: z
    .array(ChecklyServiceSchema)
    .nullish()
    .transform((v) => v ?? []),
  incidentUpdates: z
    .array(ChecklyIncidentUpdateSchema)
    .nullish()
    .transform((v) => v ?? []),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

export type ChecklyIncident = z.infer<typeof ChecklyIncidentSchema>;

export const ChecklyMaintenanceWindowSchema = z.object({
  // Checkly returns a numeric id for maintenance windows (unlike its
  // string-id resources); coerce so downstream sourceId stays a string.
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  name: z.string(),
  description: z.string().nullish(),
  tags: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  startsAt: z.string(),
  endsAt: z.string(),
  repeatUnit: z.string().nullish(),
  repeatInterval: z.number().nullish(),
  repeatEndsAt: z.string().nullish(),
  created_at: z.string().nullish(),
});

export type ChecklyMaintenanceWindow = z.infer<
  typeof ChecklyMaintenanceWindowSchema
>;

/**
 * Cursor-paginated envelope (status-pages, incidents): `{ entries, nextId }`.
 * Page-based endpoints (checks, maintenance-windows) return a bare array.
 */
export function cursorResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    entries: z.array(itemSchema),
    nextId: z.string().nullish(),
    length: z.number().nullish(),
  });
}
