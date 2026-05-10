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

  // `fetchQueryOrNotFound` throws `notFound()` for missing/forbidden rows,
  // so the route renders 404 instead of a half-rehydrated chat.
  if (Number.isFinite(sessionId)) {
    await fetchQueryOrNotFound(
      trpc.chatSession.get.queryOptions({ sessionId }),
    );
  }

  return <HydrateClient>{children}</HydrateClient>;
}
