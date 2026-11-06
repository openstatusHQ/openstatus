// Lives in services so the MCP tools share it; kept here for existing imports.
export {
  type EffectiveStatus,
  REPORT_THRESHOLD,
  REPORT_WINDOW_MINUTES,
  REPORT_WINDOW_MS,
  computeEffectiveStatus,
} from "@openstatus/services/external-service-status";
