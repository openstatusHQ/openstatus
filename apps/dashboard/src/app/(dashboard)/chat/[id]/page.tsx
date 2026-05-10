import { notFound } from "next/navigation";

import { ChatSessionClient } from "@/components/chat/chat-session-client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = Number.parseInt(id, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) notFound();
  return <ChatSessionClient sessionId={sessionId} />;
}
