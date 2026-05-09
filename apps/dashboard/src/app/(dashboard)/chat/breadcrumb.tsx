"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useParams } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";

export function Breadcrumb() {
  const params = useParams<{ id?: string | string[] }>();
  const sessionId =
    typeof params.id === "string" ? Number.parseInt(params.id, 10) : undefined;

  const trpc = useTRPC();
  const { data: session } = useQuery(
    trpc.chatSession.get.queryOptions(
      sessionId !== undefined ? { sessionId } : skipToken,
    ),
  );

  // On `/chat`: just the page label. On `/chat/[id]`: link back to
  // `/chat` + the active conversation title (falling back to a literal
  // when the session row hasn't loaded yet, e.g. mid-`replaceState`).
  if (sessionId === undefined) {
    return (
      <NavBreadcrumb
        items={[{ type: "page", label: "Assistant", icon: MessageSquare }]}
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
          icon: MessageSquare,
        },
        { type: "page", label: session?.title ?? "New chat" },
      ]}
    />
  );
}
