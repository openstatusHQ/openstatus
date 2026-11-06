"use client";

import { useQueryStates } from "nuqs";

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

type ComponentRef = { service: string; component: string };

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

/** Pinned services with their live status. Reads `serviceSummaries`. */
export function PopularServices({
  exclude,
  limit,
  id = "popular",
  title = "Popular",
  aside = "Most checked",
}: {
  exclude?: string;
  limit?: number;
  id?: string;
  title?: string;
  aside?: React.ReactNode;
}) {
  const [services] = api.externalService.serviceSummaries.useSuspenseQuery(
    POPULAR_SERVICES_INPUT,
  );
  const shown = services
    .filter((s) => s.slug !== exclude)
    .slice(0, limit ?? services.length);
  if (shown.length === 0) return null;
  return (
    <StatusSection id={id} title={title} aside={aside}>
      <PopularGrid services={shown} />
    </StatusSection>
  );
}

/** Pinned component pages with their live status. Reads `componentSummaries`. */
export function PopularComponents({
  exclude,
  limit,
  id = "popular-components",
  title = "Popular components",
  aside = "One part of a service",
}: {
  exclude?: ComponentRef;
  limit?: number;
  id?: string;
  title?: string;
  aside?: React.ReactNode;
}) {
  const [components] = api.externalService.componentSummaries.useSuspenseQuery(
    POPULAR_COMPONENTS_INPUT,
  );
  const shown = components
    .filter(
      (c) =>
        !(
          exclude &&
          c.serviceSlug === exclude.service &&
          c.slug === exclude.component
        ),
    )
    .slice(0, limit ?? components.length)
    .map((c) => ({
      slug: `${c.serviceSlug}/${c.slug}`,
      href: `/status/${c.serviceSlug}/${c.slug}`,
      name: getComponentFullName(c.serviceName, c.name),
      indicator: c.indicator,
      status: c.status,
      escalated: false,
    }));
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
