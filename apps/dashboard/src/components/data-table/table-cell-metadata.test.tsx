import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { TableCellMetadata, getMetadataEntries } from "./table-cell-metadata";

describe("getMetadataEntries", () => {
  it("returns no entries for non-objects", () => {
    for (const value of [null, undefined, "x", 1, ["a"]]) {
      expect(getMetadataEntries(value)).toEqual([]);
    }
  });

  it("sorts keys and keeps only non-blank strings", () => {
    expect(
      getMetadataEntries({ zone: "eu", app: "api", blank: "  ", count: 3 }),
    ).toEqual([
      ["app", "api"],
      ["zone", "eu"],
    ]);
  });
});

describe("TableCellMetadata", () => {
  it("renders a dash without entries", () => {
    expect(renderToStaticMarkup(<TableCellMetadata value={{}} />)).toMatch(
      />-<\/div>$/,
    );
  });

  it("collapses entries beyond maxEntries into a +n chip", () => {
    const html = renderToStaticMarkup(
      <TableCellMetadata value={{ a: "1", b: "2", c: "3" }} maxEntries={1} />,
    );
    expect(html).toContain("+2");
  });

  it("shows every entry without maxEntries", () => {
    const html = renderToStaticMarkup(
      <TableCellMetadata value={{ a: "1", b: "2" }} />,
    );
    for (const part of ["a", "1", "b", "2"]) {
      expect(html).toContain(`>${part}<`);
    }
    expect(html).not.toMatch(/>\+\d+</);
  });
});
