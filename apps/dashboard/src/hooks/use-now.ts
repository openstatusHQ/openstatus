import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs`, for relative times that must keep moving. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
