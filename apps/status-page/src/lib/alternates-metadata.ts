import type { Metadata } from "next";

import { statusPageAlternates } from "./alternates";
import { getQueryClient, trpc } from "./trpc/server";

export async function statusPageAlternatesMetadata({
  domain,
  markdownPath,
}: {
  domain: string;
  markdownPath?: string;
}): Promise<Metadata> {
  const page = await getQueryClient().fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  if (!page) return {};
  return {
    alternates: statusPageAlternates({
      slug: page.slug,
      customDomain: page.customDomain,
      markdownPath,
    }),
  };
}
