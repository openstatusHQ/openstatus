import type { Metadata } from "next";
import * as z from "zod";

import { BackButton } from "@/components/layout/back-button";
import StatusPlay from "./_components/status-play";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  timezone: z.string().optional(),
});

export const metadata: Metadata = {
  title: "Status Page Preview",
  description: "Display your status page with real time data.",
  openGraph: {
    title: "Status Page Preview",
    description: "Display your status page with real time data.",
    url: "https://www.openstatus.dev/play/status",
  },
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const timezone = search.success ? search.data.timezone : undefined;

  return (
    <>
      <BackButton href="/" />
      <StatusPlay timezone={timezone} />
    </>
  );
}
