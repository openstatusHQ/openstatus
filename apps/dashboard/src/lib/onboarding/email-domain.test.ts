import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { getCompanyDomainFromEmail } from "./email-domain";

describe("getCompanyDomainFromEmail", () => {
  it("returns the domain of a company email", () => {
    expect(getCompanyDomainFromEmail("max@openstatus.dev")).toBe(
      "openstatus.dev",
    );
  });

  it("lowercases the domain", () => {
    expect(getCompanyDomainFromEmail("Max@OpenStatus.DEV")).toBe(
      "openstatus.dev",
    );
  });

  it("ignores generic providers regardless of case", () => {
    expect(getCompanyDomainFromEmail("max@gmail.com")).toBeNull();
    expect(getCompanyDomainFromEmail("max@ProtonMail.com")).toBeNull();
    expect(getCompanyDomainFromEmail("max@pm.me")).toBeNull();
  });

  it("returns null for missing or malformed input", () => {
    expect(getCompanyDomainFromEmail(null)).toBeNull();
    expect(getCompanyDomainFromEmail(undefined)).toBeNull();
    expect(getCompanyDomainFromEmail("")).toBeNull();
    expect(getCompanyDomainFromEmail("no-at-sign")).toBeNull();
    expect(getCompanyDomainFromEmail("max@")).toBeNull();
  });
});
