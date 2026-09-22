import IPCIDR from "ip-cidr";

/**
 * Checks whether a client IP falls within any of the allowed CIDR ranges.
 * Pure function — no side effects.
 */
export function isIpAllowed(ip: string, allowedRanges: string[]): boolean {
  // No ranges configured — deny all (defensive: form validation prevents this)
  if (allowedRanges.length === 0) return false;
  return allowedRanges.some((range) => {
    try {
      const cidr = new IPCIDR(range);
      return cidr.contains(ip);
    } catch {
      // Skip malformed ranges rather than crashing the middleware
      return false;
    }
  });
}
