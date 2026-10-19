import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChangesTable,
  buildAuditLogChangeRows,
  formatValue,
} from "./changes-table";

describe("formatValue", () => {
  for (const [label, value, expected] of [
    ["null", null, "—"],
    ["undefined", undefined, "—"],
    ["empty string", "", "—"],
    ["empty array", [], "—"],
    ["string", "hello", "hello"],
    ["zero", 0, "0"],
    ["false", false, "false"],
    ["date", new Date("2024-01-02T03:04:05Z"), "2024-01-02T03:04:05.000Z"],
    ["array", [1, 2], "[1,2]"],
    ["object", { a: 1 }, '{"a":1}'],
  ] as const) {
    it(`formats ${label}`, () => {
      expect(formatValue(value)).toBe(expected);
    });
  }
});

describe("buildAuditLogChangeRows", () => {
  it("uses changedFields for an update and hides bookkeeping fields", () => {
    expect(
      buildAuditLogChangeRows({
        before: { name: "old", url: "a", updatedAt: 1 },
        after: { name: "new", url: "a", updatedAt: 2 },
        changedFields: ["name", "updatedAt"],
      }),
    ).toEqual([{ field: "name", before: "old", after: "new" }]);
  });

  it("returns nothing for an update without changedFields", () => {
    expect(
      buildAuditLogChangeRows({
        before: { name: "a" },
        after: { name: "b" },
        changedFields: null,
      }),
    ).toEqual([]);
  });

  it("lists the created fields for a create", () => {
    expect(
      buildAuditLogChangeRows({
        before: null,
        after: { name: "x", workspaceId: 1, createdAt: 0 },
        changedFields: null,
      }),
    ).toEqual([{ field: "name", after: "x" }]);
  });

  it("lists the removed fields for a delete", () => {
    const rows = buildAuditLogChangeRows({
      before: { name: "x", deletedAt: 0 },
      after: undefined,
      changedFields: undefined,
    });
    expect(rows).toEqual([{ field: "name", before: "x" }]);
    expect("after" in rows[0]).toBe(false);
  });

  it("returns nothing without before or after", () => {
    expect(
      buildAuditLogChangeRows({ before: null, after: null, changedFields: [] }),
    ).toEqual([]);
  });
});

describe("ChangesTable", () => {
  it("renders nothing for no changes", () => {
    expect(renderToStaticMarkup(<ChangesTable changes={[]} />)).toBe("");
  });

  it("renders a removed and an added line for an update", () => {
    const html = renderToStaticMarkup(
      <ChangesTable
        changes={[{ field: "name", before: "old", after: "new" }]}
      />,
    );
    expect(html).toContain("name");
    expect(html).toMatch(/data-kind="removed".*old.*data-kind="added".*new/);
  });

  it("renders only an added line for a create", () => {
    const html = renderToStaticMarkup(
      <ChangesTable changes={[{ field: "name", after: "new" }]} />,
    );
    expect(html).toContain('data-kind="added"');
    expect(html).not.toContain('data-kind="removed"');
  });

  it("distinguishes an explicit null from an absent value", () => {
    const html = renderToStaticMarkup(
      <ChangesTable changes={[{ field: "description", before: null }]} />,
    );
    expect(html).toContain('data-kind="removed"');
    expect(html).toContain("—");
    expect(html).not.toContain('data-kind="added"');
  });
});

describe("ChangesTable entity refs", () => {
  function refs(changes: Parameters<typeof ChangesTable>[0]["changes"]) {
    const html = renderToStaticMarkup(<ChangesTable changes={changes} />);
    return [
      ...html.matchAll(/data-slot="entity-ref"[^>]*aria-label="([^"]+)"/g),
    ].map((m) => m[1]);
  }

  it("renders a known id field as a ref", () => {
    expect(refs([{ field: "pageId", after: 1 }])).toEqual(["Status page 1"]);
  });

  it("renders every id of an id array", () => {
    expect(refs([{ field: "pageComponentIds", after: [3, 4] }])).toEqual([
      "Component 3",
      "Component 4",
    ]);
  });

  it("renders refs on removed lines too", () => {
    expect(refs([{ field: "monitorId", before: 2, after: 5 }])).toEqual([
      "Monitor 2",
      "Monitor 5",
    ]);
  });

  it("renders component impacts as ref and impact label", () => {
    const html = renderToStaticMarkup(
      <ChangesTable
        changes={[
          {
            field: "componentImpacts",
            after: [{ pageComponentId: 7, impact: "major_outage" }],
          },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Component 7"');
    expect(html).toContain("Major outage");
  });

  it("falls back to text for unknown fields and non-id values", () => {
    expect(
      refs([
        { field: "retry", after: 3 },
        { field: "pageId", after: null },
        { field: "monitorIds", after: [] },
        { field: "pageComponentIds", after: ["a"] },
        { field: "componentImpacts", after: ["1 → major_outage"] },
      ]),
    ).toEqual([]);
  });

  it("treats inherited object keys as plain fields", () => {
    expect(
      refs([
        { field: "toString", after: 1 },
        { field: "constructor", after: 2 },
      ]),
    ).toEqual([]);
  });
});
