export function calculatePeriod(from: Date | undefined, to: Date | undefined) {
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - (from?.getTime() ?? 0));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  console.log({ diffDays });
  if (diffDays <= 1) return "1d";
  if (diffDays <= 7) return "7d";
  if (diffDays <= 14) return "14d";
  return "14d";
}
