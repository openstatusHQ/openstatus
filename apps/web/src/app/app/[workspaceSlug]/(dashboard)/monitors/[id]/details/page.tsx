import Link from "next/link";
import * as z from "zod";

import { Button } from "@openstatus/ui";
import { flyRegions } from "@openstatus/utils";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ResponseDetails } from "../_components/response-details";

//

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  monitorId: z.string(),
  region: z.enum(flyRegions).optional(),
  cronTimestamp: z.coerce.number(),
});

export default async function Details({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success)
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

  return <ResponseDetails {...search.data} />;
}
