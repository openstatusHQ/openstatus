import { Address4, Address6 } from "ip-address";

/**
 * Checks whether a client IP falls within any of the allowed CIDR ranges.
 * Pure function — no side effects.
 */
export function isIpAllowed(ip: string, allowedRanges: string[]): boolean {
  // No ranges configured — deny all (defensive: form validation prevents this)
  if (allowedRanges.length === 0) return false;
  return allowedRanges.some((range) => {
    try {
      // ip-address 10 dropped contains(), so compare against the network's own
      // first and last address instead.
      const network = range.includes(":")
        ? new Address6(range)
        : new Address4(range);
      const address =
        network instanceof Address6 ? new Address6(ip) : new Address4(ip);
      return (
        address.bigInt() >= network.startAddress().bigInt() &&
        address.bigInt() <= network.endAddress().bigInt()
      );
    } catch {
      // Skip malformed ranges rather than crashing the middleware
      return false;
    }
  });
}
