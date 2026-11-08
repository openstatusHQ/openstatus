/** Each region code once, in first-seen order; older rows can hold duplicates. */
export function uniqueRegions(regions: string | readonly string[]): string[] {
  const list = typeof regions === "string" ? regions.split(",") : regions;
  return [...new Set(list.map((r) => r.trim()).filter((r) => r.length > 0))];
}
