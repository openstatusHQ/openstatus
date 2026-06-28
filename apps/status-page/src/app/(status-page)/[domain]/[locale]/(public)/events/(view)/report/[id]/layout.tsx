import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { statusPageAlternatesMetadata } from "../../../../../../../../../lib/alternates-metadata";
import {
  HydrateClient,
  getQueryClient,
  trpc,
} from "../../../../../../../../../lib/trpc/server";

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
    markdownPath: `/events/report/${numericId}.md`,
  });
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; domain: string }>;
}) {
  const { id, domain } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return notFound();
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.getReport.queryOptions({
      id: numericId,
      slug: domain,
    }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
