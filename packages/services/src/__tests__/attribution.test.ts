import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { toAgentUser, toAttributedUserDetail } from "../attribution";

const row = {
  id: 7,
  name: null,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  photoUrl: "",
};

describe("attribution projections", () => {
  test("detail carries email and normalizes an empty photo to null", () => {
    expect(toAttributedUserDetail(row)).toEqual({
      id: 7,
      name: "Ada Lovelace",
      email: "ada@example.com",
      photoUrl: null,
    });
  });

  test("soft-deleted user exposes no contact details", () => {
    expect(toAttributedUserDetail({ ...row, deletedAt: new Date() })).toEqual({
      id: 7,
      name: "Deleted user",
      email: null,
      photoUrl: null,
    });
  });

  test("agent projection drops email and photo", () => {
    const agent = toAgentUser(toAttributedUserDetail(row));
    expect(agent).toEqual({ id: 7, name: "Ada Lovelace" });
    expect(toAgentUser(null)).toBeNull();
  });
});
