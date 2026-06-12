export const REPORT_THRESHOLD = 7;
export const REPORT_WINDOW_MS = 15 * 60 * 1000;
export const REPORT_WINDOW_MINUTES = REPORT_WINDOW_MS / 60_000;

export type EffectiveStatus = {
  indicator: string;
  status: string;
  escalated: boolean;
};

export function computeEffectiveStatus(args: {
  providerIndicator: string;
  providerStatus: string;
  reporters: number;
  threshold: number;
}): EffectiveStatus {
  const { providerIndicator, providerStatus, reporters, threshold } = args;
  const canEscalate =
    providerIndicator === "none" && providerStatus !== "under_maintenance";
  if (canEscalate && reporters >= threshold) {
    return { indicator: "minor", status: providerStatus, escalated: true };
  }
  return {
    indicator: providerIndicator,
    status: providerStatus,
    escalated: false,
  };
}
