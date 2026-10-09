import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { personName } from "./person-name";

const empty = { name: null, firstName: null, lastName: null, email: null };

describe("personName", () => {
  it("returns null for a missing person", () => {
    expect(personName(null)).toBeNull();
  });

  it("prefers name over everything else", () => {
    expect(
      personName({
        name: "Max",
        firstName: "Maximilian",
        lastName: "Kaske",
        email: "max@openstatus.dev",
      }),
    ).toBe("Max");
  });

  it("joins first and last name when name is missing", () => {
    expect(
      personName({ ...empty, firstName: "Ada", lastName: "Lovelace" }),
    ).toBe("Ada Lovelace");
  });

  it("uses a lone first or last name without stray spaces", () => {
    expect(personName({ ...empty, firstName: "Ada" })).toBe("Ada");
    expect(personName({ ...empty, lastName: "Lovelace" })).toBe("Lovelace");
  });

  it("falls back to email", () => {
    expect(personName({ ...empty, email: "ada@example.com" })).toBe(
      "ada@example.com",
    );
  });

  it("treats empty strings as missing", () => {
    expect(
      personName({ name: "", firstName: "", lastName: "", email: "a@b.co" }),
    ).toBe("a@b.co");
  });

  it("returns null when every field is empty", () => {
    expect(personName(empty)).toBeNull();
    expect(
      personName({ name: "", firstName: "", lastName: "", email: "" }),
    ).toBeNull();
  });
});
