import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { locales } from "@openstatus/locales";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { QuorumNote } from "./quorum-note";

function text(html: string) {
  return html.replace(/<[^>]+>/g, "").replaceAll("&#x27;", "'");
}

describe("QuorumNote", () => {
  test("its message is translated in every catalog", async () => {
    const message = text(renderToStaticMarkup(<QuorumNote />));
    const id = createHash("sha512")
      .update(message)
      .digest("base64url")
      .slice(0, 6);
    for (const locale of locales) {
      const path = `${import.meta.dirname}/../../../messages/${locale}.json`;
      const catalog = JSON.parse(await readFile(path, "utf8"));
      expect(catalog[id], locale).toBeTruthy();
    }
  });
});
