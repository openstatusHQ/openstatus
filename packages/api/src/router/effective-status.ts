// Lives in services so the MCP tools share it; kept here for existing imports.
// The `/effective` entry is DB-free, so client components can import it.
export {
  type EffectiveStatus,
  REPORT_THRESHOLD,
  REPORT_WINDOW_MINUTES,
  REPORT_WINDOW_MS,
  computeEffectiveStatus,
  isFresh,
} from "@openstatus/services/external-service-status/effective";
