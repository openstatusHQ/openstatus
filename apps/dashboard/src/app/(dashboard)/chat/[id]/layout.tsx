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

  // Prefetch the active session so the breadcrumb and the conversation
  // history render without a client round-trip. `fetchQueryOrNotFound`
  // throws `notFound()` when the row isn't visible to the caller (wrong
  // workspace / wrong user / deleted), so the route renders 404 instead
  // of a half-rehydrated chat.
  if (Number.isFinite(sessionId)) {
    await fetchQueryOrNotFound(
      trpc.chatSession.get.queryOptions({ sessionId }),
    );
  }

  return <HydrateClient>{children}</HydrateClient>;
}
