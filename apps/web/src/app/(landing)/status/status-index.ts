import { filterServices } from "./filter-services";

export const STATUS_PAGE_SIZE = 60;

// "0" stands for every name that does not start with a latin letter.
export const STATUS_LETTERS = ["0", ..."abcdefghijklmnopqrstuvwxyz"] as const;

export function letterOf(name: string): string {
  const first = name.trim().charAt(0).toLowerCase();
  return first >= "a" && first <= "z" ? first : "0";
}

const SEVERITY: Record<string, number> = { minor: 1, major: 2, critical: 3 };

type IndexService = {
  slug: string;
  name: string;
  aliases: string[];
  indicator: string;
  status: string;
  escalated: boolean;
};

export function hasIssue(s: IndexService): boolean {
  return (
    (SEVERITY[s.indicator] ?? 0) > 0 ||
    s.status === "under_maintenance" ||
    s.escalated
  );
}

function issueRank(s: IndexService): number {
  if (s.status === "under_maintenance") return 0;
  return SEVERITY[s.indicator] ?? 0;
}

export function buildStatusIndex<T extends IndexService>(args: {
  services: T[];
  q: string;
  page: number;
  letter?: string;
  popularSlugs: readonly string[];
  pageSize?: number;
}) {
  const pageSize = args.pageSize ?? STATUS_PAGE_SIZE;
  const searched = filterServices(args.services, args.q);
  const matches = args.letter
    ? searched.filter((s) => letterOf(s.name) === args.letter)
    : searched;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(args.page) || 1), pageCount);
  const start = (page - 1) * pageSize;

  const bySlug = new Map(args.services.map((s) => [s.slug, s]));
  const popular = args.popularSlugs.flatMap((slug) => {
    const s = bySlug.get(slug);
    return s ? [s] : [];
  });

  const issues = args.services
    .filter(hasIssue)
    .sort(
      (a, b) =>
        issueRank(b) - issueRank(a) ||
        Number(b.escalated) - Number(a.escalated) ||
        a.name.localeCompare(b.name),
    );

  return {
    total: args.services.length,
    matches: matches.length,
    items: matches.slice(start, start + pageSize),
    start,
    page,
    pageCount,
    popular,
    issues,
  };
}
