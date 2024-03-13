import Link from "next/link";
import * as z from "zod";

import { Button } from "@openstatus/ui";
import { flyRegions } from "@openstatus/utils";

import { EmptyState } from "@/components/dashboard/empty-state";
import { api } from "@/trpc/server";
import { ResponseDetails } from "../_components/response-details";

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
      id: parseInt(search.data.monitorId),
    });
    return <ResponseDetails {...search.data} />;
  } catch (e) {
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
