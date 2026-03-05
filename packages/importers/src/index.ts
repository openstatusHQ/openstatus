export type {
  ImportConfig,
  ImportProvider,
  ImportSummary,
  PhaseResult,
  ResourceResult,
} from "./types";

export { StatuspageImportProvider } from "./providers/statuspage";
export type { StatuspageImportConfig } from "./providers/statuspage";

/**
 * Registry of all available import providers.
 * Add new providers here as they are implemented.
 */
export const IMPORT_PROVIDERS = ["statuspage"] as const;
export type ImportProviderName = (typeof IMPORT_PROVIDERS)[number];
