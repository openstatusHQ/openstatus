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
  action("page_component.update", "page_component", intId),
  action("page_component.delete", "page_component", intId),
] as const;

const pageComponentGroupActions = [
  action("page_component_group.create", "page_component_group", intId, {
    optionalMetadata: true,
  }),
  action("page_component_group.update", "page_component_group", intId),
  action("page_component_group.delete", "page_component_group", intId),
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

// Several entities below carry only a subset of the create/update/delete
// triplet. This is intentional, not an oversight:
//   - `member`: rows are created via `invitation.accept`, not directly.
//   - `integration`: rows are created by the OAuth callback handler,
//     which lives outside the service layer for now.
//   - `incident`: rows originate from the checker pipeline, not user
//     mutations.
// When those write paths migrate to the service layer, add the missing
// verbs alongside.
const memberActions = [
  // `entityId` is the removed user's id. Member rows have no surrogate key —
  // they're (userId, workspaceId) composite — so the user id is the most
  // useful identifier to fix on in the audit log.
  action("member.delete", "member", intId),
] as const;

const integrationActions = [
  action("integration.delete", "integration", intId),
] as const;

const monitorTagActions = [
  action("monitor_tag.create", "monitor_tag", intId, {
    optionalMetadata: true,
  }),
  action("monitor_tag.update", "monitor_tag", intId),
  action("monitor_tag.delete", "monitor_tag", intId),
] as const;

const privateLocationActions = [
  action("private_location.create", "private_location", intId, {
    optionalMetadata: true,
  }),
  action("private_location.update", "private_location", intId),
  action("private_location.delete", "private_location", intId),
] as const;

const extraPageSubscriberActions = [
  action("page_subscriber.update", "page_subscriber", intId),
  action("page_subscriber.delete", "page_subscriber", intId),
] as const;

export const auditActionSchema = z.discriminatedUnion("action", [
  ...monitorActions,
  ...pageActions,
  ...pageComponentActions,
  ...pageComponentGroupActions,
  ...pageSubscriberActions,
  ...extraPageSubscriberActions,
  ...apiKeyActions,
  ...notificationActions,
  ...userActions,
  ...workspaceActions,
  ...maintenanceActions,
  ...incidentActions,
  ...statusReportActions,
  ...statusReportUpdateActions,
  ...invitationActions,
  ...memberActions,
  ...integrationActions,
  ...monitorTagActions,
  ...privateLocationActions,
]);

/**
 * Audit-entry input schema — the action/entityType/entityId+metadata
 * discriminant plus optional `before`/`after` snapshots.
 *
 * Derived from `auditActionSchema` via `.and()` so the variant list
 * stays single-sourced — adding a new action here would otherwise
 * require two parallel edits.
 *
 * The `before`/`after` snapshots are intentionally loose at runtime
 * (`Record<string, unknown>`): their shapes mirror the underlying
 * entity tables and binding them to this schema would force a cycle
 * with every column definition. Shape *presence* is enforced in
 * TypeScript via the `AuditEntry` type below, keyed off the action
 * verb suffix.
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

type Snapshot = Record<string, unknown>;

/**
 * Snapshot presence is derived from the action's verb suffix:
 *
 * - `*.create` — `after` required, `before` forbidden.
 * - `*.delete` — `before` required, `after` forbidden.
 * - `*.update` — both `before` and `after` required.
 *
 * Enforced at the `emitAudit` call site via the parameter type; Zod
 * stays loose at runtime so the schema file doesn't need to know each
 * entity's column list.
 */
export type AuditEntry = AuditAction extends infer A
  ? A extends { action: `${string}.create` }
    ? A & { after: Snapshot; before?: never }
    : A extends { action: `${string}.delete` }
      ? A & { before: Snapshot; after?: never }
      : A extends { action: `${string}.update` }
        ? A & { before: Snapshot; after: Snapshot }
        : A & { before?: Snapshot; after?: Snapshot }
  : never;

export type AuditActionName = AuditAction["action"];
export type AuditEntityType = AuditAction["entityType"];
