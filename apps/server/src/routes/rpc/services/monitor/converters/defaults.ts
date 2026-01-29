/**
 * Default values for monitor fields.
 */
export const MONITOR_DEFAULTS = {
  timeout: 45000,
  retry: 3,
  followRedirects: true,
  active: false,
  public: false,
  description: "",
} as const;
