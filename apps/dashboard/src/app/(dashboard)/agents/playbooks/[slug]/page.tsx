import { isBuiltinPlaybookSlug } from "@openstatus/db/src/schema/playbooks/constants";
import { playbookSlugSchema } from "@openstatus/db/src/schema/playbooks/validation";
import { notFound } from "next/navigation";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!playbookSlugSchema.safeParse(slug).success) return notFound();

  const queryClient = getQueryClient();
  const playbook = await queryClient.fetchQuery(
    trpc.playbook.get.queryOptions({ slug }),
  );
  // a built-in slug has a page before it is written; a custom one does not
  if (!playbook && !isBuiltinPlaybookSlug(slug)) return notFound();

  return (
    <HydrateClient>
      <Client slug={slug} />
    </HydrateClient>
  );
}
