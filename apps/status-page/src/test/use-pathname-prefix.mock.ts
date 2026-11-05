// Test double for the usePathnamePrefix hook, swapped in via --import-map: the
// real hook needs a tRPC provider. Its prefix logic is covered by
// resolve-pathname-prefix.test.ts.
export const pathnamePrefix = { value: "" };

export function usePathnamePrefix() {
  return pathnamePrefix.value;
}
