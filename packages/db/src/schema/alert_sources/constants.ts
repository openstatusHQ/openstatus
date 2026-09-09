export const alertProviders = ["alertmanager", "grafana"] as const;

export type AlertProvider = (typeof alertProviders)[number];

export const DEFAULT_STALENESS_WINDOW_MINUTES = 360;
