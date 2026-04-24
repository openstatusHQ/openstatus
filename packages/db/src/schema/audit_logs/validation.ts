import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { auditLog } from "./audit_log";

/**
 * Runtime schema + discriminated-union type for every audit action
 * services emit. Paired with `emitAudit` in `@openstatus/services`,
 * which calls `AuditEntrySchema.parse(...)` before writing the row.
 *
 * Every entity gets at most three verbs: `create`, `update`, `delete`.
 * Operation-specific semantics (acknowledge, resolve, accept, revoke,
 * rename, bulk-set) collapse into whichever of the three they
 * structurally are; readers recover the specific intent by inspecting
 * `changed_fields` on the row.
 *
 * `metadata` is reserved for side-channel context that is *not*
 * derivable from the entity snapshot — e.g. `clonedFromMonitorId`,
 * `statusReportId` on a status-report update. Fields that change on the
 * entity itself belong in `before`/`after`.
 *
 * Adding a new emit site requires adding a variant here — there is no
 * escape hatch. If a new operation isn't a create/update/delete, it
 * probably shouldn't be in the audit log.
 */

const metadataSchema = z.record(z.string(), z.unknown());
const snapshotSchema = z.record(z.string(), z.unknown());

// Small helper so every variant reads the same — keeps the discriminated
// union legible when skimming.
function action<A extends string, E extends string, I extends z.ZodTypeAny>(
  action: A,
  entityType: E,
  entityIdSchema: I,
  opts: { optionalMetadata?: boolean } = {},
) {
  return z.object({
    action: z.literal(action),
    entityType: z.literal(entityType),
    entityId: entityIdSchema,
    ...(opts.optionalMetadata ? { metadata: metadataSchema.optional() } : {}),
  });
}

const intId = z.number().int();

const monitorActions = [
  action("monitor.create", "monitor", intId, { optionalMetadata: true }),
  action("monitor.update", "monitor", intId),
  action("monitor.delete", "monitor", intId),
] as const;

const pageActions = [
  action("page.create", "page", intId, { optionalMetadata: true }),
  action("page.update", "page", intId),
  action("page.delete", "page", intId),
] as const;

const pageComponentActions = [
  action("page_component.create", "page_component", intId, {
    optionalMetadata: true,
  }),
  // Page-level reorder lives under `page_component.update` but is
  // audited against the parent page — the action targets the page's
  // component *layout*, not an individual component.
  action("page_component.update", "page", intId),
  action("page_component.delete", "page_component", intId),
] as const;

const pageComponentGroupActions = [
  action("page_component_group.create", "page_component_group", intId, {
    optionalMetadata: true,
  }),
] as const;

const pageSubscriberActions = [
  action("page_subscriber.create", "page_subscriber", intId, {
    optionalMetadata: true,
  }),
] as const;

const apiKeyActions = [
  action("api_key.create", "api_key", intId, { optionalMetadata: true }),
  action("api_key.delete", "api_key", intId),
] as const;

const notificationActions = [
  action("notification.create", "notification", intId),
  action("notification.update", "notification", intId),
  action("notification.delete", "notification", intId),
] as const;

const userActions = [action("user.delete", "user", intId)] as const;

const workspaceActions = [
  action("workspace.update", "workspace", intId),
] as const;

const maintenanceActions = [
  action("maintenance.create", "maintenance", intId, {
    optionalMetadata: true,
  }),
  action("maintenance.update", "maintenance", intId),
  action("maintenance.delete", "maintenance", intId),
] as const;

const incidentActions = [
  action("incident.update", "incident", intId),
  action("incident.delete", "incident", intId),
] as const;

const statusReportActions = [
  action("status_report.create", "status_report", intId, {
    optionalMetadata: true,
  }),
  action("status_report.update", "status_report", intId),
  action("status_report.delete", "status_report", intId),
] as const;

const statusReportUpdateActions = [
  action("status_report_update.create", "status_report_update", intId, {
    optionalMetadata: true,
  }),
  action("status_report_update.update", "status_report_update", intId),
  action("status_report_update.delete", "status_report_update", intId),
] as const;

const invitationActions = [
  action("invitation.create", "invitation", intId, { optionalMetadata: true }),
  action("invitation.update", "invitation", intId),
  action("invitation.delete", "invitation", intId),
] as const;

export const auditActionSchema = z.discriminatedUnion("action", [
  ...monitorActions,
  ...pageActions,
  ...pageComponentActions,
  ...pageComponentGroupActions,
  ...pageSubscriberActions,
  ...apiKeyActions,
  ...notificationActions,
  ...userActions,
  ...workspaceActions,
  ...maintenanceActions,
  ...incidentActions,
  ...statusReportActions,
  ...statusReportUpdateActions,
  ...invitationActions,
]);

/**
 * Audit-entry input schema — the action/entityType/entityId+metadata
 * discriminant plus optional `before`/`after` snapshots.
 *
 * Derived from `auditActionSchema` via `.and()` so the variant list
 * stays single-sourced — adding a new action here would otherwise
 * require two parallel edits.
 *
 * The `before`/`after` snapshots are intentionally loose
 * (`Record<string, unknown>`): their shapes mirror the underlying
 * entity tables and binding them to this schema would force a cycle
 * with every column definition.
 */
export const auditEntrySchema = auditActionSchema.and(
  z.object({
    before: snapshotSchema.optional(),
    after: snapshotSchema.optional(),
  }),
);

export const insertAuditLogSchema = createInsertSchema(auditLog);
export const selectAuditLogSchema = createSelectSchema(auditLog);

export type AuditAction = z.infer<typeof auditActionSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditActionName = AuditAction["action"];
export type AuditEntityType = AuditAction["entityType"];
