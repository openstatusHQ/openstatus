import * as z from "zod";

import { Separator } from "@openstatus/ui";
import { flyRegions } from "@openstatus/utils";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ResponseDetails } from "../../../_components/response-details";
import { Modal } from "./modal";

//

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  monitorId: z.string(),
  region: z.enum(flyRegions).optional(),
  cronTimestamp: z.coerce.number(),
});

export default async function DetailsModal({
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
      />
    );

  return (
    <Modal>
      <Separator className="mb-4" />
      <ResponseDetails {...search.data} />
    </Modal>
  );
}
