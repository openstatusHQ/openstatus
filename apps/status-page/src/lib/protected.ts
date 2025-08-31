export function createProtectedCookieKey(value: string) {
  return `secured-${value}`;
}
