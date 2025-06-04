import type { Assertion } from "@openstatus/assertions";
import {
  HeaderAssertion,
  StatusAssertion,
  TextBodyAssertion,
} from "@openstatus/assertions";
import type { z } from "zod";
import type { assertion, assertionsSchema } from "./schema";

export const getAssertions = (
  assertions: z.infer<typeof assertion>[],
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


export const getAssertionNew = (
  assertions: z.infer<typeof assertionsSchema>[],
): Assertion[] => {
  const assert: Assertion[] = [];

  for (const a of assertions) {
    if (a.kind === "header") {
      assert.push(
        new HeaderAssertion({
          key: a.key,
          target: a.target,
          compare: a.compare,
          type: "header",
          version: "v1",
        }),
      );
    }
    if (a.kind === "textBody") {
      assert.push(new TextBodyAssertion({  target: a.target, compare:a.compare, type: "textBody", version: "v1" }));
    }
    if (a.kind === "statusCode") {
      assert.push(new StatusAssertion({  compare: a.compare, type: "status", version: "v1", target: a.target }));
    }
  }
  return assert;
};
