import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { statusPageAlternatesMetadata } from "../../../../../../../lib/alternates-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; domain: string }>;
}): Promise<Metadata> {
  const { id, domain } = await params;
  const numericId = Number(id);
  if (Number.isNaN(numericId)) return {};
  return statusPageAlternatesMetadata({
    domain,
    markdownPath: `/monitors/${numericId}.md`,
  });
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; domain: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return notFound();
  }

  // NOTE: we are not prefetching the `statusPage.getMonitor` query as we want to lazy load it
  // mainly because it's data from tinybird and we don't want to prefetch it (like the uptime data from the homepage)

  return children;
}
