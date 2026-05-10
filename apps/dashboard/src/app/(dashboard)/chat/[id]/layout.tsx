import { notFound } from "next/navigation";

import { HydrateClient, fetchQueryOrNotFound, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = Number.parseInt(id, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) notFound();

  // `fetchQueryOrNotFound` throws `notFound()` for missing/forbidden rows,
  // so the route renders 404 instead of a half-rehydrated chat.
  await fetchQueryOrNotFound(trpc.chatSession.get.queryOptions({ sessionId }));

  return <HydrateClient>{children}</HydrateClient>;
}
