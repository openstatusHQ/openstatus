import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ResponseDetails } from "@/components/monitor-dashboard/response-details";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

export default async function Details({
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  params,
  searchParams,
}: {
  params: { id: string; workspaceSlug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsCache.parse(searchParams);

  if (!search.monitorId) return <PageEmptyState />;

  try {
    await api.monitor.getMonitorById.query({
      id: Number.parseInt(search.monitorId),
    });
    return <ResponseDetails {...search} />;
  } catch (_e) {
    return <PageEmptyState />;
  }
}

function PageEmptyState() {
  return (
    <EmptyState
      title="No log found"
      description="Seems like we couldn't find what you are looking for."
      icon="alert-triangle"
      action={
        <Button asChild>
          <Link href="./data">Response Logs</Link>
        </Button>
      }
    />
  );
}
