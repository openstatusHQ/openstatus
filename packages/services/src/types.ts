// Type re-exports for surface files (routers / handlers) that must reference
// domain row shapes without importing `@openstatus/db` directly once the Biome
// ban is in effect.
//
// Policy: rows + enums only. Insert/select Zod schemas, Drizzle table objects,
// and db-internal types stay inside this package.
//
// Types are added incrementally per domain migration PR to keep the surface
// lean; re-exports are by reference so schema column evolution flows through.

export type {
  Workspace,
  WorkspacePlan,
  WorkspaceRole,
} from "@openstatus/db/src/schema";

export type {
  StatusReport,
  StatusReportStatus,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";

export type { Page, PageComponent } from "@openstatus/db/src/schema";

export type { Maintenance } from "@openstatus/db/src/schema";
