// A view sets this on its own `tools/call`, so analytics can tell a click in the
// chart from a call the model made. Hosts forward `params._meta` untouched.
export const VIEW_CALL_META = { "openstatus.dev/origin": "view" } as const;

export function isViewCall(meta: unknown): boolean {
  if (typeof meta !== "object" || meta === null) return false;
  const [[key, value]] = Object.entries(VIEW_CALL_META);
  return (meta as Record<string, unknown>)[key] === value;
}
