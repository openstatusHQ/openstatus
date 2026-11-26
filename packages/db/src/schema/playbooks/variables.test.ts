import { describe, expect, it } from "vitest";

import { playbookVariableNames, renderPlaybook } from "./variables";

describe("playbookVariableNames", () => {
  it("lists each name once, in order of first use", () => {
    expect(
      playbookVariableNames("{{b}} {{ a }} {{b}} {{#if x}} {{Team}} {{a.b}}"),
    ).toEqual(["b", "a"]);
  });
});

describe("renderPlaybook", () => {
  it("fills set variables and leaves the others as written", () => {
    expect(
      renderPlaybook("{{a}} {{ b }} {{c}}", { a: "1", b: "", constructor: "" }),
    ).toBe("1 {{ b }} {{c}}");
  });

  it("does not expand a value that looks like a variable", () => {
    expect(renderPlaybook("{{a}}", { a: "{{b}}", b: "x" })).toBe("{{b}}");
  });
});
