import type { Metadata } from "next";

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
import { ServiceCardGrid } from "./service-card-grid";
import { ServiceSearch } from "./service-search";
import { buildStatusIndex } from "./status-index";
import { StatusPagination } from "./status-pagination";

export const dynamic = "force-dynamic";

const ISSUES_SHOWN = 10;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { q, page } = await searchParamsCache.parse(props.searchParams);
  const hasQuery = q.trim() !== "";
  const metadata = getListingMetadata({
    ...sections.status,
    ogImage: `${BASE_URL}/api/og/external-service`,
  });

  return {
    ...metadata,
    ...(page > 1 && !hasQuery
      ? {
          title: `${sections.status.title} (page ${page})`,
          alternates: {
            ...metadata.alternates,
            canonical: `/status?page=${page}`,
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
  const { q, page } = await searchParamsCache.parse(props.searchParams);
  const query = q.trim();
  const services = await api.externalService.grid();
  const index = buildStatusIndex({
    services,
    q: query,
    page,
    popularSlugs: POPULAR_STATUS_SLUGS,
  });
  const firstPage = index.page === 1 && query === "";
  const rangeEnd = index.start + index.items.length;

  return (
    <section className="prose dark:prose-invert mb-12 flex max-w-none flex-col gap-4">
      <ContentBoxContainer className="not-prose mb-2 px-3 py-2 text-sm">
        <CustomLink
          href={`${APP_URL}?ref=status-index-top`}
          className="font-medium underline-offset-4 hover:underline"
        >
          Catch downtime instantly and keep your users in the loop with
          OpenStatus →
        </CustomLink>
      </ContentBoxContainer>

      <div>
        <h1 className="mb-2!">Is it down?</h1>
        <p className="my-0!">
          Live status for {formatCount(index.total)} services. We read their
          official status pages every few minutes and add what users report.
          Open a service to see what is broken and since when.
        </p>
      </div>

      <ServiceSearch />

      {query !== "" ? (
        <>
          <p
            className="not-prose text-muted-foreground my-0! text-xs"
            role="status"
          >
            {index.matches === 0
              ? `No services match “${query}”.`
              : `${formatCount(index.matches)} ${index.matches === 1 ? "service matches" : "services match"} “${query}”`}
          </p>
          <ServiceCardGrid services={index.items} />
        </>
      ) : null}

      {firstPage && index.issues.length > 0 ? (
        <>
          <h2 className="mb-0!">Having issues now</h2>
          <p className="not-prose text-muted-foreground my-0! text-xs">
            {index.issues.length > ISSUES_SHOWN
              ? `Worst first. Showing ${ISSUES_SHOWN} of ${index.issues.length}.`
              : "Worst first."}
          </p>
          <ServiceCardGrid services={index.issues.slice(0, ISSUES_SHOWN)} />
        </>
      ) : null}

      {firstPage && index.popular.length > 0 ? (
        <>
          <h2 className="mb-0!">Popular</h2>
          <ServiceCardGrid services={index.popular} />
        </>
      ) : null}

      {query === "" ? (
        <>
          <h2 id="all" className="mb-0!">
            All services
          </h2>
          <p
            className="not-prose text-muted-foreground my-0! text-xs"
            role="status"
          >
            Showing {formatCount(index.start + 1)}–{formatCount(rangeEnd)} of{" "}
            {formatCount(index.total)}, A–Z
          </p>
          <ServiceCardGrid services={index.items} />
        </>
      ) : null}

      <StatusPagination
        page={index.page}
        pageCount={index.pageCount}
        q={query}
      />

      <ContentBoxContainer className="not-prose bg-muted/30 mt-10 flex flex-col items-start gap-3">
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
