import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";

import { defaultLocale, locales } from "@openstatus/locales";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

// next-intl's extractor derives ids from the source text; catalogs drift
// silently when that format changes (4.14 moved base64 -> base64url).
async function messageId(message: string) {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(message),
  );
  return Buffer.from(digest).toString("base64url").slice(0, 6);
}

async function readCatalog(locale: string): Promise<Record<string, string>> {
  const path = `${import.meta.dirname}/../../messages/${locale}.json`;
  return JSON.parse(await readFile(path, "utf8"));
}

describe("message catalogs", () => {
  test("source ids match next-intl's extractor hash", async () => {
    const source = await readCatalog(defaultLocale);
    const mismatched: string[] = [];
    for (const [id, message] of Object.entries(source)) {
      if ((await messageId(message)) !== id) mismatched.push(id);
    }
    expect(mismatched).toEqual([]);
  });

  test("every locale has the same ids as the source locale", async () => {
    const source = Object.keys(await readCatalog(defaultLocale)).sort();
    for (const locale of locales) {
      const ids = Object.keys(await readCatalog(locale)).sort();
      expect(ids, locale).toEqual(source);
    }
  });
});
