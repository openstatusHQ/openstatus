import type { z } from "zod";

import type {
  assertion,
  headerAssertion,
  statusAssertion,
  textBodyAssertion,
} from "./v1";

export type AssertionRequest = {
  body: string;
  header: Record<string, string>;
  status: number;
};

export type AssertionResult =
  | {
      success: true;
      message?: never;
    }
  | {
      success: false;
      message: string;
    };
export interface Assertion {
  schema: z.infer<typeof assertion>;
  assert: (req: AssertionRequest) => AssertionResult;
}

export type AssertionType = z.infer<typeof headerAssertion>;
export type StatusAssertionType = z.infer<typeof statusAssertion>;
export type TextBodyAssertionType = z.infer<typeof textBodyAssertion>;
