import { z } from "zod";

import type { Assertion } from "./types";
import {
  HeaderAssertion,
  JsonBodyAssertion,
  StatusAssertion,
  TextBodyAssertion,
  base,
  headerAssertion,
  jsonBodyAssertion,
  statusAssertion,
  textBodyAssertion,
} from "./v1";

export function serialize(assertions: Assertion[]): string {
  return JSON.stringify(assertions.map((a) => a.schema));
}
export function deserialize(s: string): Assertion[] {
  const bases = z.array(base).parse(JSON.parse(s));
  return bases.map((b) => {
    switch (b.type) {
      case "status":
        return new StatusAssertion(statusAssertion.parse(b));
      case "header":
        return new HeaderAssertion(headerAssertion.parse(b));
      case "jsonBody":
        return new JsonBodyAssertion(jsonBodyAssertion.parse(b));
      case "textBody":
        return new TextBodyAssertion(textBodyAssertion.parse(b));

      default:
        throw new Error(`unknown assertion type: ${b.type}`);
    }
  });
}
