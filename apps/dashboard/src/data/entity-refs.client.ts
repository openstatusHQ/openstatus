import type { AuditEntityType } from "@openstatus/db/src/schema/audit_logs/validation";
import {
  Components,
  Incident,
  type IconType,
  Maintenance,
  Monitor,
  Notification,
  PrivateLocation,
  Report,
  StatusPage,
} from "@openstatus/icons";

type EntityKindConfig = {
  label: string;
  icon: IconType;
  /** Change-row and tool-schema fields that hold this kind's id(s). */
  fields: readonly string[];
  /** The audit-log `entityType` for this kind. */
  auditType: AuditEntityType;
  /** Dashboard page for the entity. */
  href: (entity: never) => string;
};

/** One entry per referenceable entity; add a card in `entity-ref/cards` too. */
export const entityKinds = {
  page: {
    label: "Status page",
    icon: StatusPage,
    fields: ["pageId"],
    auditType: "page",
    href: (page: { id: number }) => `/status-pages/${page.id}/status-reports`,
  },
  pageComponent: {
    label: "Component",
    icon: Components,
    fields: ["pageComponentId", "pageComponentIds", "componentId"],
    auditType: "page_component",
    href: (component: { pageId: number }) =>
      `/status-pages/${component.pageId}/components`,
  },
  monitor: {
    label: "Monitor",
    icon: Monitor,
    fields: ["monitorId", "monitorIds"],
    auditType: "monitor",
    href: (monitor: { id: number }) => `/monitors/${monitor.id}/overview`,
  },
  statusReport: {
    label: "Status report",
    icon: Report,
    fields: ["statusReportId"],
    auditType: "status_report",
    href: (report: { id: number; pageId: number }) =>
      `/status-pages/${report.pageId}/status-reports/${report.id}`,
  },
  maintenance: {
    label: "Maintenance",
    icon: Maintenance,
    fields: ["maintenanceId"],
    auditType: "maintenance",
    href: (maintenance: { id: number; pageId: number }) =>
      `/status-pages/${maintenance.pageId}/maintenances/${maintenance.id}`,
  },
  incident: {
    label: "Incident",
    icon: Incident,
    fields: ["incidentId"],
    auditType: "incident",
    href: (incident: { id: number }) => `/incidents/${incident.id}`,
  },
  privateLocation: {
    label: "Private location",
    icon: PrivateLocation,
    fields: ["privateLocationId", "privateLocationIds"],
    auditType: "private_location",
    href: () => "/settings/private-locations",
  },
  notification: {
    label: "Notification",
    icon: Notification,
    fields: ["notificationId", "notificationIds"],
    auditType: "notification",
    // Notifiers are edited in a sheet on the list; there is no detail page.
    href: () => "/notifications",
  },
} as const satisfies Record<string, EntityKindConfig>;

export type EntityKind = keyof typeof entityKinds;

// Safe because the keys of a `satisfies`-checked literal are exactly `EntityKind`.
export const entityKindList = Object.keys(entityKinds) as EntityKind[];

export type FieldRefKind = EntityKind | "componentImpacts";

// Maps, not object lookups, so inherited keys (`constructor`) never match.
const fieldKinds = new Map<string, FieldRefKind>([
  ...entityKindList.flatMap((kind) =>
    entityKinds[kind].fields.map((field) => [field, kind] as const),
  ),
  ["componentImpacts", "componentImpacts"],
]);

const auditKinds = new Map<string, EntityKind>(
  entityKindList.map((kind) => [entityKinds[kind].auditType, kind]),
);

/** What a change-row field references, by its name. */
export function fieldRefKind(field: string): FieldRefKind | undefined {
  return fieldKinds.get(field);
}

/** The ref kind for an audit-log `entityType`; `undefined` when it has no card. */
export function auditEntityKind(type: string): EntityKind | undefined {
  return auditKinds.get(type);
}

/** A positive integer id from a number or digit string, else `undefined`. */
export function toEntityId(value: unknown): number | undefined {
  const id =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id
    : undefined;
}

/** A non-empty list of ids, else `undefined` (one bad entry fails the list). */
export function toEntityIds(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const ids: number[] = [];
  for (const item of value) {
    // Strings stay text here: a diff value of "4" is not a reference.
    if (typeof item !== "number") return undefined;
    const id = toEntityId(item);
    if (id === undefined) return undefined;
    ids.push(id);
  }
  return ids;
}

/** `select` for list queries: the row with `id`, or `undefined`. */
export function findById(id: number) {
  return <T extends { id: number }>(rows: readonly T[] | undefined) =>
    rows?.find((row) => row.id === id);
}
