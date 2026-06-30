import {
  describe as nodeDescribe,
  it as nodeIt,
  test as nodeTest,
} from "node:test";

type Body = () => void | Promise<void>;
type BaseFn = (name: string, body: Body) => void;
type EachCase = readonly unknown[];

const formatName = (name: string, args: EachCase, index: number): string => {
  let i = 0;
  const interpolated = name.replace(/%[spdijfo%]/g, (token) => {
    if (token === "%%") return "%";
    const arg = args[i++];
    return typeof arg === "string" ? arg : JSON.stringify(arg);
  });
  return interpolated === name && args.length > 0
    ? `${name} [${index}]`
    : interpolated;
};

const makeEach =
  (base: BaseFn) =>
  <T extends EachCase>(cases: readonly T[]) =>
  (name: string, body: (...args: T) => void | Promise<void>): void => {
    cases.forEach((args, index) => {
      base(formatName(name, args, index), () => body(...args));
    });
  };

// node:test's `test`/`it`/`describe` lack Jest/Bun's `.each`; everything else
// (.skip/.todo/.only) exists natively and is preserved by reference.
type Augmented<F> = F & {
  each: <T extends EachCase>(
    cases: readonly T[],
  ) => (name: string, body: (...args: T) => void | Promise<void>) => void;
};

const augment = <F extends typeof nodeTest>(base: F): Augmented<F> => {
  const fn = base as Augmented<F>;
  fn.each = makeEach(base as unknown as BaseFn);
  return fn;
};

export const test = augment(nodeTest);
export const it = augment(nodeIt);
export const describe = augment(
  nodeDescribe as unknown as typeof nodeTest,
) as unknown as Augmented<typeof nodeDescribe>;
export {
  after,
  after as afterAll,
  afterEach,
  before,
  before as beforeAll,
  beforeEach,
} from "node:test";
