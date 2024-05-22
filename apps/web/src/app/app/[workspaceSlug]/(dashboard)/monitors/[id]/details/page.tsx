import Link from "next/link";
import * as z from "zod";

import { Button } from "@openstatus/ui";
import { flyRegions } from "@openstatus/utils";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ResponseDetails } from "@/components/monitor-dashboard/response-details";
import { api } from "@/trpc/server";

//

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  monitorId: z.string(),
  url: z.string(),
  region: z.enum(flyRegions).optional(),
  cronTimestamp: z.coerce.number(),
});

export default async function Details({
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  params,
  searchParams,
}: {
  params: { id: string; workspaceSlug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success) return <PageEmptyState />;

  try {
    await api.monitor.getMonitorById.query({
      id: Number.parseInt(search.data.monitorId),
    });
    return <ResponseDetails {...search.data} />;
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
