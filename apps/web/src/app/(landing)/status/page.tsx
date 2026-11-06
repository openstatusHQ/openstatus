import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ButtonLink } from "../../../content/mdx-components/button-link";
import { CustomLink } from "../../../content/mdx-components/custom-link";
import { sections } from "../../../content/sections";
import {
  APP_URL,
  BASE_URL,
  defaultMetadata,
  getListingMetadata,
} from "../../../lib/metadata/shared-metadata";
import { HydrateClient } from "../../../trpc/rq-server";
import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxTitle,
} from "../content-box";
import { Client } from "./client";
import {
  getPrefetchedGrid,
  prefetchPopularStatus,
} from "./prefetch";
import { searchParamsCache } from "./search-params";
import { AgentHint, StatusSkeleton } from "./service-blocks";
import { statusHref } from "./status-href";
import { buildStatusIndex } from "./status-index";

export const dynamic = "force-dynamic";

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

export default async function Page(props: PageProps) {
  const params = await searchParamsCache.parse(props.searchParams);
  const query = params.q.trim();
  const letter = query === "" ? params.letter : null;
  const [services] = await Promise.all([
    getPrefetchedGrid(),
    prefetchPopularStatus(),
  ]);
  const index = buildStatusIndex({
    services,
    q: query,
    page: params.page,
    letter: letter ?? undefined,
    popularSlugs: [],
  });
  // ?page=999 or ?page=0: send to the page actually shown, so the title and
  // canonical never name a page that does not exist.
  if (index.page !== params.page) {
    redirect(statusHref({ q: query, letter, page: index.page }));
  }
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

      <HydrateClient>
        <Suspense fallback={<StatusSkeleton />}>
          <Client />
        </Suspense>
      </HydrateClient>

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
