import type { Metadata } from "next";
import { Suspense } from "react";

import { ButtonLink } from "@/content/mdx-components/button-link";
import { CustomLink } from "@/content/mdx-components/custom-link";
import {
  APP_URL,
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { HydrateClient, api } from "@/trpc/rq-server";
import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxTitle,
} from "../content-box";

import { ExternalStatusGrid } from "./external-status-grid";
import { ServiceSearch } from "./service-search";

export const dynamic = "force-dynamic";

const TITLE = "External Status";
const DESCRIPTION =
  "Easily check if your external providers is working properly";

type SearchParams = Promise<{ q?: string }>;

export async function generateMetadata(props: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = await props.searchParams;
  const hasQuery = (q ?? "").trim() !== "";

  return {
    ...defaultMetadata,
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: "/status",
    },
    robots: hasQuery ? { index: false, follow: true } : defaultMetadata.robots,
    openGraph: {
      ...ogMetadata,
      title: TITLE,
      description: DESCRIPTION,
      images: [`${BASE_URL}/api/og/external-service`],
    },
    twitter: {
      ...twitterMetadata,
      title: TITLE,
      description: DESCRIPTION,
      images: [`${BASE_URL}/api/og/external-service`],
    },
  };
}

export default async function Page() {
  await api.externalService.grid.prefetch();

  return (
    <section className="prose dark:prose-invert mb-12 max-w-none">
      <ContentBoxContainer className="not-prose my-6 px-4 py-2 text-sm">
        <CustomLink
          href={`${APP_URL}?ref=status-index-top`}
          className="font-medium underline-offset-4 hover:underline"
        >
          Catch downtime instantly and keep your users in the loop with
          OpenStatus →
        </CustomLink>
      </ContentBoxContainer>

      <HydrateClient>
        <ServiceSearch />
        <Suspense
          fallback={
            <p className="text-muted-foreground">Loading external status…</p>
          }
        >
          <ExternalStatusGrid />
        </Suspense>
      </HydrateClient>

      <ContentBoxContainer className="not-prose mt-10 flex flex-col items-start gap-3 bg-muted/30">
        <ContentBoxTitle className="m-0! text-lg">
          Looking for a status page?
        </ContentBoxTitle>
        <ContentBoxDescription className="m-0! text-sm">
          Every service needs a status page. Run yours with OpenStatus.
        </ContentBoxDescription>
        <ButtonLink href={`${APP_URL}?ref=status-index-bottom`}>
          Create your status page
        </ButtonLink>
      </ContentBoxContainer>
    </section>
  );
}
