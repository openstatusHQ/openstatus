import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ButtonLink } from "../../../content/mdx-components/button-link";
import { CustomLink } from "../../../content/mdx-components/custom-link";
import { sections } from "../../../content/sections";
import { POPULAR_STATUS_SLUGS } from "../../../data/popular-status";
import {
  APP_URL,
  BASE_URL,
  defaultMetadata,
  getListingMetadata,
} from "../../../lib/metadata/shared-metadata";
import { api } from "../../../trpc/rq-server";
import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxTitle,
} from "../content-box";
import { searchParamsCache } from "./search-params";
import {
  AgentHint,
  IssueList,
  LetterNav,
  PopularGrid,
  ServiceList,
  StatusPagination,
  StatusSection,
} from "./service-blocks";
import { ServiceSearch } from "./service-search";
import { statusHref } from "./status-href";
import { buildStatusIndex } from "./status-index";

export const dynamic = "force-dynamic";

const ISSUES_SHOWN = 10;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { q, page, letter } = await searchParamsCache.parse(props.searchParams);
  const hasQuery = q.trim() !== "";
  const metadata = getListingMetadata({
    ...sections.status,
    ogImage: `${BASE_URL}/api/og/external-service`,
  });
  const browsing = !hasQuery && (page > 1 || letter !== null);
  const label = letter === "0" ? "#" : letter?.toUpperCase();

  return {
    ...metadata,
    ...(browsing
      ? {
          title: [
            sections.status.title,
            label ? `services starting with ${label}` : null,
            page > 1 ? `page ${page}` : null,
          ]
            .filter(Boolean)
            .join(", "),
          alternates: {
            ...metadata.alternates,
            canonical: statusHref({ letter, page }),
          },
        }
      : {}),
    robots: hasQuery ? { index: false, follow: true } : defaultMetadata.robots,
  };
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function Page(props: PageProps) {
  const params = await searchParamsCache.parse(props.searchParams);
  const query = params.q.trim();
  const letter = query === "" ? params.letter : null;
  const services = await api.externalService.grid();
  const index = buildStatusIndex({
    services,
    q: query,
    page: params.page,
    letter: letter ?? undefined,
    popularSlugs: POPULAR_STATUS_SLUGS,
  });
  // ?page=999 or ?page=0: send to the page actually shown, so the title and
  // canonical never name a page that does not exist.
  if (index.page !== params.page) {
    redirect(statusHref({ q: query, letter, page: index.page }));
  }
  const landing = index.page === 1 && query === "" && letter === null;
  const rangeEnd = index.start + index.items.length;

  return (
    <section className="prose dark:prose-invert mb-12 flex max-w-none flex-col gap-10">
      <ContentBoxContainer className="not-prose px-3 py-2 text-sm">
        <CustomLink
          href={`${APP_URL}?ref=status-index-top`}
          className="font-medium underline-offset-4 hover:underline"
        >
          Catch downtime instantly and keep your users in the loop with
          OpenStatus →
        </CustomLink>
      </ContentBoxContainer>

      <div className="flex flex-col gap-3">
        <h1 className="m-0!">Is it down?</h1>
        <p className="m-0!">
          Live status for {formatCount(index.total)} services. We read their
          official status pages every few minutes and add what users report.
          Open a service to see what is broken and since when.
        </p>
        <ServiceSearch />
        <p className="not-prose text-muted-foreground m-0 text-sm tabular-nums">
          {formatCount(index.total)} services ·{" "}
          {formatCount(index.issues.length)} with issues right now
        </p>
      </div>

      {landing && index.issues.length > 0 ? (
        <StatusSection
          id="issues"
          title="Having issues now"
          count={formatCount(index.issues.length)}
          aside="Worst first"
        >
          <IssueList services={index.issues.slice(0, ISSUES_SHOWN)} />
          {index.issues.length > ISSUES_SHOWN ? (
            <p className="text-muted-foreground m-0 text-sm">
              and {formatCount(index.issues.length - ISSUES_SHOWN)} more with
              smaller issues
            </p>
          ) : null}
        </StatusSection>
      ) : null}

      {landing && index.popular.length > 0 ? (
        <StatusSection id="popular" title="Popular" aside="Most checked">
          <PopularGrid services={index.popular} />
        </StatusSection>
      ) : null}

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

      <AgentHint markdownPath="/status.md" />

      <ContentBoxContainer className="not-prose bg-muted/30 flex flex-col items-start gap-3">
        <ContentBoxTitle className="m-0! text-lg">
          Looking for a status page?
        </ContentBoxTitle>
        <ContentBoxDescription className="m-0! text-sm">
          Every service needs a status page. Run yours with OpenStatus — see
          what a{" "}
          <CustomLink href="/status-page" className="underline-offset-4">
            hosted status page
          </CustomLink>{" "}
          includes.
        </ContentBoxDescription>
        <ButtonLink href={`${APP_URL}?ref=status-index-bottom`}>
          Create your status page
        </ButtonLink>
      </ContentBoxContainer>
    </section>
  );
}
