export type {
  ComponentImpact,
  ImportConfig,
  ImportProvider,
  ImportSummary,
  PhaseResult,
  ResourceResult,
  UpdateComponentImpact,
} from "./types";

export { createStatuspageProvider } from "./providers/statuspage";
export type { StatuspageImportConfig } from "./providers/statuspage";

export { createBetterstackProvider } from "./providers/betterstack";
export type { BetterstackImportConfig } from "./providers/betterstack";

export { createInstatusProvider } from "./providers/instatus";
export type { InstatusImportConfig } from "./providers/instatus";

export { createChecklyProvider } from "./providers/checkly";
export type { ChecklyImportConfig } from "./providers/checkly";

/**
 * Registry of all available import providers.
 * Add new providers here as they are implemented.
 */
export const IMPORT_PROVIDERS = [
  "statuspage",
  "betterstack",
  "instatus",
  "checkly",
] as const;
export type ImportProviderName = (typeof IMPORT_PROVIDERS)[number];
