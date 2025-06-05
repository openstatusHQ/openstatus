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
      const {kind, ...rest} = a;
      assert.push(
        new HeaderAssertion({
          ...rest,
          type: "header",
          version: "v1",
        }),
      );
    }
    if (a.kind === "textBody") {
      const {kind, ...rest} = a;

      assert.push(new TextBodyAssertion({  ...rest, type: "textBody", version: "v1" }));
    }
    if (a.kind === "statusCode") {
      const {kind, ...rest} = a;
      assert.push(new StatusAssertion({  ...rest, type: "status", version: "v1"}));
    }
  }
  return assert;
};
