import { playbookSlugs } from "@openstatus/db/src/schema/playbooks/constants";
import { notFound } from "next/navigation";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const param = (await params).slug;
  const slug = playbookSlugs.find((s) => s === param);
  if (!slug) return notFound();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.playbook.get.queryOptions({ slug }));

  return (
    <HydrateClient>
      <Client slug={slug} />
    </HydrateClient>
  );
}
