import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  getActions,
  toComponentSections,
  toGroupNameLookup,
} from "./page-components.client";

const groups = [
  { id: 1, name: "API" },
  { id: 2, name: "Empty" },
];

function component(
  id: number,
  order: number,
  groupId: number | null = null,
  groupOrder: number | null = null,
) {
  return { id, name: `c${id}`, order, groupId, groupOrder };
}

function shape(sections: ReturnType<typeof toComponentSections>) {
  return sections.map((s) => ({
    group: s.group?.name ?? null,
    items: s.items.map((c) => c.id),
  }));
}

describe("toComponentSections", () => {
  it("places a group at its first member's order and sorts members by groupOrder", () => {
    const sections = toComponentSections(
      [
        component(10, 0),
        component(11, 3, 1, 2),
        component(12, 2, 1, 1),
        component(13, 5),
      ],
      groups,
    );
    expect(shape(sections)).toEqual([
      { group: null, items: [10] },
      { group: "API", items: [12, 11] },
      { group: null, items: [13] },
    ]);
  });

  it("merges consecutive ungrouped components into one section", () => {
    const sections = toComponentSections(
      [component(3, 2), component(1, 0), component(2, 1)],
      groups,
    );
    expect(shape(sections)).toEqual([{ group: null, items: [1, 2, 3] }]);
  });

  it("drops empty groups and treats unknown groupIds as ungrouped", () => {
    const sections = toComponentSections([component(1, 0, 99)], groups);
    expect(shape(sections)).toEqual([{ group: null, items: [1] }]);
  });

  it("treats missing order as 0", () => {
    const sections = toComponentSections(
      [component(1, 1), { id: 2, name: "c2" }],
      [],
    );
    expect(shape(sections)).toEqual([{ group: null, items: [2, 1] }]);
  });
});

describe("toGroupNameLookup", () => {
  it("maps grouped components to their group name only", () => {
    const lookup = toGroupNameLookup(
      [
        { id: 1, groupId: 1 },
        { id: 2, groupId: null },
        { id: 3, groupId: 99 },
      ],
      groups,
    );
    expect([...lookup]).toEqual([[1, "API"]]);
  });
});

describe("getActions", () => {
  it("attaches the delete handler", () => {
    const onDelete = () => {};
    expect(getActions({ delete: onDelete })[0].onClick).toBe(onDelete);
    expect(getActions({})[0].onClick).toBeUndefined();
  });
});
