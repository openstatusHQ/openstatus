import { notFound } from "next/navigation";

import { playbookTypeFromSlug } from "@/data/playbooks.client";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const type = playbookTypeFromSlug((await params).type);
  if (!type) return notFound();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.playbook.get.queryOptions({ type }));

  return (
    <HydrateClient>
      <Client type={type} />
    </HydrateClient>
  );
}
