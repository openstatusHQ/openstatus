import { ChatClient } from "@/components/chat/chat-client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = Number.parseInt(id, 10);
  if (Number.isNaN(sessionId)) return null;
  return <ChatClient sessionId={sessionId} />;
}
