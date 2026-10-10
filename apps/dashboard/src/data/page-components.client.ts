import { Delete } from "@openstatus/icons";

export const actions = [
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type PageComponentAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<PageComponentAction["id"], () => Promise<void> | void>>,
): (PageComponentAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};

/** A page component with enough ordering info to list it in page order. */
export type OrderedComponent = {
  id: number;
  name: string;
  groupId?: number | null;
  order?: number | null;
  groupOrder?: number | null;
};

export type ComponentSection<C extends OrderedComponent> = {
  /** null for a run of ungrouped components */
  group: { id: number; name: string } | null;
  items: C[];
};

/**
 * Splits components into sections in page order, as the components config
 * and the public page show them: ungrouped components by `order`, a group
 * placed at its first member's `order`, members by `groupOrder`. Consecutive
 * ungrouped components share one section; empty groups are dropped.
 */
export function toComponentSections<C extends OrderedComponent>(
  components: C[],
  groups: { id: number; name: string }[] = [],
): ComponentSection<C>[] {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const members = new Map<number, C[]>();
  const ungrouped: C[] = [];
  for (const c of components) {
    if (c.groupId != null && groupById.has(c.groupId)) {
      members.set(c.groupId, [...(members.get(c.groupId) ?? []), c]);
    } else {
      ungrouped.push(c);
    }
  }

  const entries: { order: number; section: ComponentSection<C> }[] = [];
  for (const c of ungrouped) {
    entries.push({ order: c.order ?? 0, section: { group: null, items: [c] } });
  }
  for (const [groupId, items] of members) {
    const group = groupById.get(groupId);
    if (!group) continue;
    items.sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
    entries.push({
      order: Math.min(...items.map((c) => c.order ?? 0)),
      section: { group: { id: group.id, name: group.name }, items },
    });
  }
  entries.sort((a, b) => a.order - b.order);

  // merge adjacent ungrouped singletons into one run
  const sections: ComponentSection<C>[] = [];
  for (const { section } of entries) {
    const last = sections.at(-1);
    if (section.group === null && last?.group === null) {
      last.items.push(...section.items);
    } else {
      sections.push(section);
    }
  }
  return sections;
}

/** componentId -> group name, for components in a known group. */
export function toGroupNameLookup(
  components: { id: number; groupId?: number | null }[],
  groups: { id: number; name: string }[],
): Map<number, string> {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const lookup = new Map<number, string>();
  for (const c of components) {
    const name = c.groupId != null ? groupName.get(c.groupId) : undefined;
    if (name) lookup.set(c.id, name);
  }
  return lookup;
}
