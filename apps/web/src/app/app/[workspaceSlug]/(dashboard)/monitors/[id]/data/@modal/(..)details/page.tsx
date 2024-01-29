import * as z from "zod";

import { flyRegions } from "@openstatus/utils";

import { ResponseDetails } from "../../_components/response-details";
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

  if (!search.success) return <div>Something went wrong</div>;

  return (
    <Modal>
      <ResponseDetails {...search.data} />
    </Modal>
  );
}
