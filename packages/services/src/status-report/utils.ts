export function formatComponentImpacts(
  impacts: readonly { pageComponentId: number; impact: string }[],
): string[] {
  return impacts.map((ci) => `${ci.pageComponentId} → ${ci.impact}`);
}
