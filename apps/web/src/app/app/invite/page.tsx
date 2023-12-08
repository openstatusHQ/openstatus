import Link from "next/link";
import { z } from "zod";

import { Button } from "@openstatus/ui";

import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  token: z.string(),
});

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  const message = search.success
    ? await api.invitation.acceptInvitation.mutate({ token: search.data.token })
    : "Invalid token";

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground text-lg">{message}</p>
      <Button>
        <Link href="/app">Dashboard</Link>
      </Button>
    </div>
  );
}
