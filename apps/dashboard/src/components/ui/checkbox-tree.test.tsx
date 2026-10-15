import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { CheckboxTree, toCheckboxTreeItems } from "./checkbox-tree";

describe("toCheckboxTreeItems", () => {
  it("nests grouped components and keeps ungrouped ones as leaves", () => {
    expect(
      toCheckboxTreeItems(
        [
          { id: 1, name: "Website", order: 0 },
          { id: 2, name: "REST", order: 1, groupId: 7, groupOrder: 0 },
          { id: 3, name: "GraphQL", order: 2, groupId: 7, groupOrder: 1 },
        ],
        [{ id: 7, name: "API" }],
      ),
    ).toEqual([
      { id: 1, label: "Website" },
      {
        id: 7,
        label: "API",
        children: [
          { id: 2, label: "REST" },
          { id: 3, label: "GraphQL" },
        ],
      },
    ]);
  });
});

describe("CheckboxTree", () => {
  const noop = () => {};
  const items = [
    { id: 1, label: "Website" },
    {
      id: 7,
      label: "API",
      children: [
        { id: 2, label: "REST" },
        { id: 3, label: "GraphQL" },
      ],
    },
  ];

  function states(value: number[]) {
    const html = renderToStaticMarkup(
      <CheckboxTree items={items} value={value} onValueChange={noop} />,
    );
    return [...html.matchAll(/role="checkbox" aria-checked="([^"]+)"/g)].map(
      (m) => m[1],
    );
  }

  it("renders a row per leaf, group and child", () => {
    expect(states([])).toEqual(["false", "false", "false", "false"]);
  });

  it("marks a partially selected group as indeterminate", () => {
    expect(states([2])).toEqual(["false", "mixed", "true", "false"]);
  });

  it("marks a fully selected group as checked", () => {
    expect(states([1, 2, 3])).toEqual(["true", "true", "true", "true"]);
  });

  it("hides a group without children", () => {
    const html = renderToStaticMarkup(
      <CheckboxTree
        items={[{ id: 9, label: "Empty group", children: [] }]}
        value={[]}
        onValueChange={noop}
      />,
    );
    expect(html).not.toContain("Empty group");
  });
});
