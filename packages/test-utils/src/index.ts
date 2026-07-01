// Single import surface for migrated tests: `import { ... } from "@openstatus/test-utils"`.
// Importing this module registers the Bun-compat matchers (./matchers side-effect).
import "./matchers.ts";

export {
  after,
  afterAll,
  afterEach,
  before,
  beforeAll,
  beforeEach,
  describe,
  it,
  test,
} from "./runner.ts";
export { expect } from "jsr:@std/expect";
export { type MockFn, mock } from "./mock-fn.ts";
export {
  assertSpyCall,
  assertSpyCalls,
  returnsNext,
  type Spy,
  spy,
  type Stub,
  stub,
} from "jsr:@std/testing/mock";
export { FakeTime } from "jsr:@std/testing/time";
