"use client";

import { useQueryStates } from "nuqs";

import {
  POPULAR_STATUS,
  type PopularStatusEntry,
} from "../../../data/popular-status";
import { api } from "../../../trpc/rq-client";
import {
  POPULAR_COMPONENTS_INPUT,
  POPULAR_SERVICES_INPUT,
} from "./query-inputs";
import { letterParser, pageParser, qParser } from "./search-params";
import {
  IssueList,
  LetterNav,
  PopularGrid,
  ServiceList,
  StatusPagination,
  StatusSection,
} from "./service-blocks";
import { ServiceSearch } from "./service-search";
import { buildStatusIndex } from "./status-index";
import { getComponentFullName } from "./utils";

// Composable, data-connected blocks for the status pages. Each one reads its
// own tRPC query, so a page only prefetches what it renders (see the
// `prefetch*` helpers in ./prefetch.ts) and drops the block in.


function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Index header: title, intro with the live count, search, totals. Reads the grid. */
export function StatusHeader() {
  const [services] = api.externalService.grid.useSuspenseQuery();
  const { total, issues } = buildStatusIndex({
    services,
    q: "",
    page: 1,
    popularSlugs: [],
  });
  return (
    <div className="flex flex-col gap-3">
      <h1 className="m-0!">Is it down?</h1>
      <p className="m-0!">
        Live status for {formatCount(total)} services. We read their official
        status pages every few minutes and add what users report. Open a service
        to see what is broken and since when.
      </p>
      <ServiceSearch />
      <p className="not-prose text-muted-foreground m-0 text-sm tabular-nums">
        {formatCount(total)} services · {formatCount(issues.length)} with issues
        right now
      </p>
    </div>
  );
}

/** Services reporting a problem right now, worst first. Reads the grid. */
export function IssuesNow({ limit = 10 }: { limit?: number }) {
  const [services] = api.externalService.grid.useSuspenseQuery();
  const { issues } = buildStatusIndex({
    services,
    q: "",
    page: 1,
    popularSlugs: [],
  });
  if (issues.length === 0) return null;
  return (
    <StatusSection
      id="issues"
      title="Having issues now"
      count={formatCount(issues.length)}
      aside="Worst first"
    >
      <IssueList services={issues.slice(0, limit)} />
      {issues.length > limit ? (
        <p className="text-muted-foreground m-0 text-sm">
          and {formatCount(issues.length - limit)} more with smaller issues
        </p>
      ) : null}
    </StatusSection>
  );
}

type PopularTile = {
  slug: string;
  href?: string;
  name: string;
  indicator: string;
  status: string;
  escalated: boolean;
};

/**
 * The pinned status pages, services and components mixed in the order of
 * POPULAR_STATUS. Reads `serviceSummaries` and `componentSummaries`.
 * `exclude` drops the page being viewed.
 */
export function PopularStatus({
  exclude,
  limit,
  id = "popular",
  title = "Popular",
  aside = "Most checked",
}: {
  exclude?: PopularStatusEntry;
  limit?: number;
  id?: string;
  title?: string;
  aside?: React.ReactNode;
}) {
  const [services] = api.externalService.serviceSummaries.useSuspenseQuery(
    POPULAR_SERVICES_INPUT,
  );
  const [components] = api.externalService.componentSummaries.useSuspenseQuery(
    POPULAR_COMPONENTS_INPUT,
  );
  const serviceBySlug = new Map(services.map((s) => [s.slug, s]));
  const componentByKey = new Map(
    components.map((c) => [`${c.serviceSlug}/${c.slug}`, c]),
  );

  const shown = POPULAR_STATUS.flatMap((entry): PopularTile[] => {
    const component = "component" in entry ? entry.component : undefined;
    if (
      exclude &&
      exclude.service === entry.service &&
      exclude.component === component
    ) {
      return [];
    }
    if (component) {
      const c = componentByKey.get(`${entry.service}/${component}`);
      return c
        ? [
            {
              slug: `${c.serviceSlug}/${c.slug}`,
              href: `/status/${c.serviceSlug}/${c.slug}`,
              name: getComponentFullName(c.serviceName, c.name),
              indicator: c.indicator,
              status: c.status,
              escalated: false,
            },
          ]
        : [];
    }
    const s = serviceBySlug.get(entry.service);
    return s
      ? [
          {
            slug: s.slug,
            name: s.name,
            indicator: s.indicator,
            status: s.status,
            escalated: s.escalated,
          },
        ]
      : [];
  }).slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <StatusSection id={id} title={title} aside={aside}>
      <PopularGrid services={shown} />
    </StatusSection>
  );
}

/** Search results or the A–Z list with pagination. Reads the grid and the URL. */
export function ServiceDirectory() {
  const [services] = api.externalService.grid.useSuspenseQuery();
  const [params] = useQueryStates({
    q: qParser,
    page: pageParser,
    letter: letterParser,
  });
  const query = params.q.trim();
  const letter = query === "" ? params.letter : null;
  const index = buildStatusIndex({
    services,
    q: query,
    page: params.page,
    letter: letter ?? undefined,
    popularSlugs: [],
  });
  const rangeEnd = index.start + index.items.length;

  return (
    <>
      {query !== "" ? (
        <StatusSection
          id="all"
          title={`Results for “${query}”`}
          count={formatCount(index.matches)}
        >
          {index.matches === 0 ? (
            <p className="text-muted-foreground m-0">
              No service matches “{query}”. Try a shorter name.
            </p>
          ) : (
            <ServiceList services={index.items} />
          )}
        </StatusSection>
      ) : (
        <StatusSection
          id="all"
          title="All services"
          aside={
            index.matches > 0
              ? `${formatCount(index.start + 1)}–${formatCount(rangeEnd)} of ${formatCount(index.matches)}`
              : undefined
          }
        >
          <LetterNav active={letter} />
          {index.matches === 0 ? (
            <p className="text-muted-foreground m-0">
              No tracked service starts with{" "}
              {letter === "0" ? "a digit or symbol" : letter?.toUpperCase()}.
            </p>
          ) : (
            <ServiceList services={index.items} />
          )}
        </StatusSection>
      )}
      <StatusPagination
        page={index.page}
        pageCount={index.pageCount}
        q={query}
        letter={letter}
      />
    </>
  );
}

/** True on the bare index: page 1, no search, no letter. Reads the URL. */
export function useIsStatusLanding(): boolean {
  const [params] = useQueryStates({
    q: qParser,
    page: pageParser,
    letter: letterParser,
  });
  return params.q.trim() === "" && params.page <= 1 && params.letter == null;
}
