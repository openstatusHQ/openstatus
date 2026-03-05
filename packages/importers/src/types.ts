/**
 * Result of importing a single resource.
 */
export type ResourceResult = {
  sourceId: string;
  openstatusId?: number;
  name: string;
  status: "created" | "skipped" | "failed";
  error?: string;
  data?: unknown;
};

/**
 * Result of a single import phase (e.g., "components", "incidents").
 */
export type PhaseResult = {
  phase: string;
  status: "completed" | "partial" | "failed" | "skipped";
  resources: ResourceResult[];
};

/**
 * Summary returned after a full import completes.
 */
export type ImportSummary = {
  provider: string;
  status: "completed" | "partial" | "failed";
  startedAt: Date;
  completedAt: Date;
  phases: PhaseResult[];
  errors: string[];
};

/**
 * Configuration passed to any import provider.
 */
export type ImportConfig = {
  apiKey: string;
  workspaceId: number;
  pageId?: number;
  dryRun?: boolean;
};

/**
 * Every import provider must implement this interface.
 */
export interface ImportProvider<TConfig extends ImportConfig = ImportConfig> {
  readonly name: string;
  validate(config: TConfig): Promise<{ valid: boolean; error?: string }>;
  run(config: TConfig): Promise<ImportSummary>;
}
