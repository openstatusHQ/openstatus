import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { getJsonLDOrganization } from "./structured-data";

describe("getJsonLDOrganization", () => {
  test("publishes a postal address alongside the contact points", () => {
    const org = getJsonLDOrganization();
    // schema-dts types every node as `object | string`; narrow once.
    if (typeof org === "string") throw new Error("expected an Organization");

    expect(org.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "122 Rue Amelot",
      postalCode: "75011",
      addressLocality: "Paris",
      addressCountry: "FR",
    });
    expect(Array.isArray(org.contactPoint)).toBe(true);
  });
});
