import { expect } from "jsr:@std/expect";

// @std/expect stopped re-exporting its matcher-context type; these matchers only
// read `value`, so a minimal local shape is enough.
type ExpectMatcherContext = { value: unknown };

type MatcherResult = { pass: boolean; message: () => string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const size = (v: unknown): number => {
  if (typeof v === "string" || Array.isArray(v)) return v.length;
  if (v instanceof Map || v instanceof Set) return v.size;
  if (isObject(v)) return Object.keys(v).length;
  return -1;
};

// Bun's `expect` extension matchers, reimplemented on @std/expect so the ~150
// existing call sites keep working under `deno test`.
expect.extend({
  toBeNumber(context: ExpectMatcherContext): MatcherResult {
    const pass =
      typeof context.value === "number" && !Number.isNaN(context.value);
    return { pass, message: () => `expected ${context.value} to be a number` };
  },
  toBeString(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: typeof context.value === "string",
      message: () => `expected ${context.value} to be a string`,
    };
  },
  toBeBoolean(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: typeof context.value === "boolean",
      message: () => `expected ${context.value} to be a boolean`,
    };
  },
  toBeArray(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: Array.isArray(context.value),
      message: () => `expected ${context.value} to be an array`,
    };
  },
  toBeTrue(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: context.value === true,
      message: () => `expected ${context.value} to be true`,
    };
  },
  toBeFalse(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: context.value === false,
      message: () => `expected ${context.value} to be false`,
    };
  },
  toBeNil(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: context.value === null || context.value === undefined,
      message: () => `expected ${context.value} to be null or undefined`,
    };
  },
  toBeEmpty(context: ExpectMatcherContext): MatcherResult {
    return {
      pass: size(context.value) === 0,
      message: () => `expected ${context.value} to be empty`,
    };
  },
  toBeOneOf(
    context: ExpectMatcherContext,
    expected: readonly unknown[],
  ): MatcherResult {
    return {
      pass: expected.includes(context.value),
      message: () =>
        `expected ${context.value} to be one of ${JSON.stringify(expected)}`,
    };
  },
  toContainValue(context: ExpectMatcherContext, value: unknown): MatcherResult {
    const pass =
      isObject(context.value) && Object.values(context.value).includes(value);
    return { pass, message: () => `expected object to contain value ${value}` };
  },
  toContainKey(context: ExpectMatcherContext, key: string): MatcherResult {
    const pass =
      isObject(context.value) && Object.keys(context.value).includes(key);
    return { pass, message: () => `expected object to contain key ${key}` };
  },
  pass(_context: ExpectMatcherContext, _message?: string): MatcherResult {
    return { pass: true, message: () => _message ?? "passed" };
  },
  fail(_context: ExpectMatcherContext, message?: string): MatcherResult {
    return { pass: false, message: () => message ?? "failed" };
  },
});
