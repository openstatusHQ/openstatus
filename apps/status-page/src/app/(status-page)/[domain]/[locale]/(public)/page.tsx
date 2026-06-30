import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { embedSearchParamsCache } from "./search-params";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { embed } = await embedSearchParamsCache.parse(searchParams);
  if (embed.mode) {
    return { robots: { index: false, follow: false } };
  }
  return {};
}

// NOTE: if we ever add a server component that reads embed state without
// receiving `searchParams` as a prop, populate the cache here:
//   await embedSearchParamsCache.parse(searchParams);
// `generateMetadata` already parses per-request, so the client tree doesn't
// need it for SSR correctness (nuqs reads the URL directly on both sides).
export default async function Page({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.getExternalSection.queryOptions({ slug: domain }),
  );
  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
