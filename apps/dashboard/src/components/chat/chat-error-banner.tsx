type Props = {
  error: Error;
};

const RATE_LIMIT_RESET_RE = /Reset at (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/;

export function ChatErrorBanner({ error }: Props) {
  const message = error.message ?? "";
  const isRateLimit = /Rate limit/i.test(message);
  return (
    <div className="bg-destructive/10 text-destructive border-t px-4 py-2 text-sm">
      {isRateLimit
        ? `You've hit the daily message cap${formatResetSuffix(message)}.`
        : "The assistant encountered an error. Try again."}
    </div>
  );
}

function formatResetSuffix(message: string): string {
  const match = message.match(RATE_LIMIT_RESET_RE);
  if (!match) return "";
  const resetAt = new Date(match[1]);
  if (Number.isNaN(resetAt.getTime())) return "";
  const time = resetAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return ` — try again at ${time}`;
}
