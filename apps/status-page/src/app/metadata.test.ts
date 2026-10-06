import { expect } from "jsr:@std/expect";
import { describe, test } from "jsr:@std/testing/bdd";

import {
  defaultMetadata,
  themeExplorerMetadata,
  TITLE,
} from "./metadata.ts";

describe("metadata", () => {
  test("defaultMetadata sets default title without a global suffix template", () => {
    expect(defaultMetadata.title).toEqual({
      default: TITLE,
    });
  });

  test("themeExplorerMetadata sets title template and default title", () => {
    const meta = themeExplorerMetadata({ indexable: true });
    expect(meta.title).toEqual({
      template: `%s | ${TITLE}`,
      default: `Theme Explorer | ${TITLE}`,
    });
  });
});
