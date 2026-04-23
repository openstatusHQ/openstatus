import { getLogger } from "@logtape/logtape";

import {
  type Actor,
  type DB,
  type ServiceContext,
  extractActorId,
} from "./context";

const logger = getLogger(["services", "audit"]);

export type AuditEntry = {
  /** Canonical action identifier, e.g. "status_report.create". */
  action: string;
  /** Entity type the action targets, e.g. "status_report". */
  entityType: string;
  entityId: number | string;
  /**
   * Accepted at the call site for audit log v2 (dedicated table with scrub/redact
   * policy) but dropped before writing in v1 — logs are not the right place for
   * PII-bearing payloads. Callers still emit full entries so v2 only needs to
   * change emitAudit's body, not the ~200 future emitter sites.
   */
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export type AuditLogRecord = {
  workspaceId: number;
  actorType: Actor["type"];
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string | undefined;
};

// Test-only audit buffer. Tests opt in via installTestAuditBuffer(); when
// active, emitAudit pushes records into the buffer so tests can assert against
// them without parsing logs.
let testBuffer: AuditLogRecord[] | null = null;

export function installTestAuditBuffer(): AuditLogRecord[] {
  const buffer: AuditLogRecord[] = [];
  testBuffer = buffer;
  return buffer;
}

export function uninstallTestAuditBuffer(): void {
  testBuffer = null;
}

export async function emitAudit(
  // `tx` is unused in v1 but part of the contract: audit rows will be written
  // inside the caller's transaction in v2. Signature stays stable.
  _tx: DB,
  ctx: ServiceContext,
  entry: AuditEntry,
): Promise<void> {
  const record: AuditLogRecord = {
    workspaceId: ctx.workspace.id,
    actorType: ctx.actor.type,
    actorId: extractActorId(ctx.actor),
    action: entry.action,
    entityType: entry.entityType,
    entityId: String(entry.entityId),
    requestId: ctx.requestId,
  };

  if (testBuffer) testBuffer.push(record);

  logger.info(`audit: ${record.action}`, { audit: true, ...record });
}
