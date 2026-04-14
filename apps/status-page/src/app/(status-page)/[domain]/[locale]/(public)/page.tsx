import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Client } from "./client";
import { iframeSearchParamsCache } from "./search-params";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { iframe } = await iframeSearchParamsCache.parse(searchParams);
  if (iframe.mode) {
    return { robots: { index: false, follow: false } };
  }
  return {};
}

// NOTE: if we ever add a server component that reads iframe state without
// receiving `searchParams` as a prop, populate the cache here:
//   await iframeSearchParamsCache.parse(searchParams);
// `generateMetadata` already parses per-request, so the client tree doesn't
// need it for SSR correctness (nuqs reads the URL directly on both sides).
export default function Page() {
  return <Client />;
}
