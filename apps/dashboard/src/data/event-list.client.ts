import { format } from "date-fns";

export type MonthGroup<T> = {
  /** `yyyy-MM`, stable across renders. */
  key: string;
  label: string;
  items: T[];
};

/** Buckets by local calendar month, keeping the input order within and across groups. */
export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => Date,
): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const date = getDate(item);
    const key = format(date, "yyyy-MM");
    let group = groups.get(key);
    if (!group) {
      group = { key, label: format(date, "MMMM yyyy"), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return Array.from(groups.values());
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** `API, Website +2`: the first `max` names, then how many more. */
export function listNames(names: string[], max = 2) {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max}`;
}
