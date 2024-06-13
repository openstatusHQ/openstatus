import type { z } from "zod";
import type { Assertion } from "../../../../../packages/assertions/src";
import {
  HeaderAssertion,
  StatusAssertion,
  TextBodyAssertion,
} from "../../../../../packages/assertions/src/v1";
import type { assertion } from "./schema";

export const getAssertions = (
  assertions: z.infer<typeof assertion>[]
): Assertion[] => {
  const assert: Assertion[] = [];

  for (const a of assertions) {
    if (a.type === "header") {
      assert.push(new HeaderAssertion({ ...a, version: "v1" }));
    }
    if (a.type === "textBody") {
      assert.push(new TextBodyAssertion({ ...a, version: "v1" }));
    }
    if (a.type === "status") {
      assert.push(new StatusAssertion({ ...a, version: "v1" }));
    }
  }
  return assert;
};
