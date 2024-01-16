import * as z from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema";
import { Separator } from "@openstatus/ui";

import { InputForm } from "./_components/input-form";
import { RequestDetails } from "./_components/request-details";
import { checkAllRegions } from "./utils";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.string().optional(),
  region: monitorFlyRegionSchema.optional(),
});

export default async function PlayPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  const region = search.success ? search.data.region : undefined;
  const id = search.success ? search.data.id : undefined;

  // TODO: add cache with redis

  const data = await checkAllRegions("https://google.com");

  return (
    <div className="grid gap-8">
      <div className="mx-auto grid gap-4 text-center">
        <p className="font-cal mb-1 text-3xl">Monitor</p>
        <p className="text-muted-foreground text-lg font-light">
          Check your connection to the internet.
        </p>
      </div>
      <InputForm />
      <Separator />
      <RequestDetails regions={data} searchRegion={region} />
    </div>
  );
}
