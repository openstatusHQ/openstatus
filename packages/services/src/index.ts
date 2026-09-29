export {
  type Actor,
  type DB,
  type DrizzleClient,
  type DrizzleTx,
  type ServiceContext,
  defaultTb,
  extractActorId,
  isTx,
  tryGetActorUserId,
  withTransaction,
} from "./context";

export {
  isRetryableDbError,
  isTransientServerError,
  retryRead,
  withBusyRetry,
} from "./retry";

export {
  ConflictError,
  ForbiddenError,
  InternalServiceError,
  LimitExceededError,
  NotFoundError,
  PreconditionFailedError,
  ServiceError,
  type ServiceErrorCode,
  UnauthorizedError,
  ValidationError,
} from "./errors";

export {
  type AuditAction,
  type AuditActionName,
  auditActionSchema,
  type AuditEntityType,
  type AuditEntry,
  auditEntrySchema,
  diffTopLevel,
  emitAudit,
} from "./audit";

export { matchesScope, requireRole, requireScope } from "./auth";

export {
  enabledFeatures,
  FEATURES,
  type Feature,
  isFeatureEnabled,
  requireFeature,
} from "./features";

export {
  LIMIT_KEYS,
  assertWithinLimit,
  countWorkspaceUsage,
  getPlanLimits,
  type LimitKey,
} from "./limits";

export * from "./types";
