const DAY_MS = 86_400_000;

export function getTrialDaysLeft(trialEndsAt: Date | null | undefined) {
  if (!trialEndsAt) return null;
  const msLeft = trialEndsAt.getTime() - Date.now();
  if (msLeft <= 0) return null;
  return Math.ceil(msLeft / DAY_MS);
}
