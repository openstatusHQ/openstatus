"use client";

import { Chat } from "@openstatus/icons";
import { skipToken, useQuery } from "@tanstack/react-query";

import { useChatSessionContext } from "@/components/chat/chat-session-context";
import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";

export function Breadcrumb() {
  // Context (not `useParams`) so we follow runtime `replaceState` URL swaps.
  const { sessionId } = useChatSessionContext();

  const trpc = useTRPC();
  const { data: session } = useQuery(
    trpc.chatSession.get.queryOptions(
      sessionId !== undefined ? { sessionId } : skipToken,
    ),
  );

  if (sessionId === undefined) {
    return (
      <NavBreadcrumb
        items={[{ type: "page", label: "Assistant", icon: Chat }]}
      />
    );
  }

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Assistant",
          href: "/chat",
          icon: Chat,
        },
        { type: "page", label: session?.title ?? "New chat" },
      ]}
    />
  );
}
