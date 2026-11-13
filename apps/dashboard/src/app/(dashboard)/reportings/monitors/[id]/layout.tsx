import { notFound } from "next/navigation";

import {
  HydrateClient,
  fetchQueryOrNotFound,
  getQueryClient,
  trpc,
} from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const policyId = Number(id);
  if (!Number.isInteger(policyId) || policyId <= 0) notFound();

  const workspace = await getQueryClient().fetchQuery(
    trpc.workspace.get.queryOptions(),
  );
  // a locked plan gets the paywall from the page, not a 404
  if (workspace.limits["monitor-sla"]) {
    await fetchQueryOrNotFound(
      trpc.monitorReporting.summary.queryOptions({ id: policyId }),
    );
  }

  return <HydrateClient>{children}</HydrateClient>;
}
