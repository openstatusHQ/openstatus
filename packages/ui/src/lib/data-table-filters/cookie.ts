// Controls panel open/close state (global).
// A cookie, not localStorage: the panel renders during SSR, so the state has to
// be known on the server. A client-side read only lands after hydration, and
// the correction would animate the panel's width on every page load.
export const CONTROLS_COOKIE_NAME = "data_table_controls_state";
export const CONTROLS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
