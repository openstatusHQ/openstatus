// Bun-compatible `mock()` for the Deno migration. Bun's mock function isn't
// available under `deno test`; this reimplements the subset our suites use
// (the jest-style `.mock.calls` + `.mockX()` helpers) on plain closures.
//
// NOTE: bun's `mock.module(specifier, factory)` has no Deno equivalent and is
// intentionally NOT provided here — module replacement is done via the
// `--import-map` flag and test-double modules instead.

// oxlint-disable-next-line typescript/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface MockState {
  // oxlint-disable-next-line typescript/no-explicit-any
  calls: any[][];
  results: { type: "return" | "throw"; value: unknown }[];
}

export interface MockFn extends AnyFn {
  mock: MockState;
  mockClear(): MockFn;
  mockReset(): MockFn;
  mockImplementation(fn: AnyFn): MockFn;
  mockImplementationOnce(fn: AnyFn): MockFn;
  mockReturnValue(value: unknown): MockFn;
  mockReturnValueOnce(value: unknown): MockFn;
  mockResolvedValue(value: unknown): MockFn;
  mockResolvedValueOnce(value: unknown): MockFn;
  mockRejectedValue(value: unknown): MockFn;
  mockRestore(): MockFn;
}

export function mock(impl?: AnyFn): MockFn {
  let defaultImpl = impl;
  const onceQueue: AnyFn[] = [];
  const state: MockState = { calls: [], results: [] };

  // oxlint-disable-next-line typescript/no-explicit-any
  const fn = ((...args: any[]) => {
    state.calls.push(args);
    const use = onceQueue.length ? onceQueue.shift() : defaultImpl;
    try {
      const value = use ? use(...args) : undefined;
      state.results.push({ type: "return", value });
      return value;
    } catch (err) {
      state.results.push({ type: "throw", value: err });
      throw err;
    }
  }) as MockFn;

  fn.mock = state;
  // Expose the @std/expect mock interface (Symbol.for("@MOCK")) so its
  // `.toHaveBeenCalled*` matchers recognize this shim, not just `.mock.calls`.
  Object.defineProperty(fn, Symbol.for("@MOCK"), {
    get() {
      return {
        calls: state.calls.map((args, i) => {
          const r = state.results[i];
          return {
            args,
            returned: r?.type === "return" ? r.value : undefined,
            thrown: r?.type === "throw" ? r.value : undefined,
            timestamp: 0,
            returns: r?.type === "return",
            throws: r?.type === "throw",
          };
        }),
      };
    },
  });
  fn.mockClear = () => {
    state.calls = [];
    state.results = [];
    return fn;
  };
  fn.mockReset = () => {
    fn.mockClear();
    onceQueue.length = 0;
    defaultImpl = undefined;
    return fn;
  };
  fn.mockImplementation = (f) => {
    defaultImpl = f;
    return fn;
  };
  fn.mockImplementationOnce = (f) => {
    onceQueue.push(f);
    return fn;
  };
  fn.mockReturnValue = (value) => {
    defaultImpl = () => value;
    return fn;
  };
  fn.mockReturnValueOnce = (value) => {
    onceQueue.push(() => value);
    return fn;
  };
  fn.mockResolvedValue = (value) => {
    defaultImpl = () => Promise.resolve(value);
    return fn;
  };
  fn.mockResolvedValueOnce = (value) => {
    onceQueue.push(() => Promise.resolve(value));
    return fn;
  };
  fn.mockRejectedValue = (value) => {
    defaultImpl = () => Promise.reject(value);
    return fn;
  };
  fn.mockRestore = () => fn;
  return fn;
}
