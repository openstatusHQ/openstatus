export type {
  ImportConfig,
  ImportProvider,
  ImportSummary,
  PhaseResult,
  ResourceResult,
} from "./types";

export { createStatuspageProvider } from "./providers/statuspage";
export type { StatuspageImportConfig } from "./providers/statuspage";

export { createBetterstackProvider } from "./providers/betterstack";
export type { BetterstackImportConfig } from "./providers/betterstack";

export { createInstatusProvider } from "./providers/instatus";
export type { InstatusImportConfig } from "./providers/instatus";

/**
 * Registry of all available import providers.
 * Add new providers here as they are implemented.
 */
export const IMPORT_PROVIDERS = [
  "statuspage",
  "betterstack",
  "instatus",
] as const;
export type ImportProviderName = (typeof IMPORT_PROVIDERS)[number];
