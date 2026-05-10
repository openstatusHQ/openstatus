"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { useChatSessionContext } from "@/components/chat/chat-session-context";
import { SidebarRight } from "@/components/nav/sidebar-right";
import { useTRPC } from "@/lib/trpc/client";

export function Sidebar() {
  const router = useRouter();
  const { sessionId: activeId } = useChatSessionContext();

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: sessions } = useQuery(trpc.chatSession.list.queryOptions());

  const deleteMutation = useMutation(
    trpc.chatSession.delete.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.chatSession.list.queryKey(),
        });
        if (variables.sessionId === activeId) router.push("/chat");
      },
    }),
  );

  return (
    <SidebarRight
      header="Conversations"
      // defaultOpen
      metadata={[
        {
          label: "Recent",
          type: "list",
          items: (sessions ?? []).map((s) => ({
            id: s.id,
            label: s.title,
            meta: formatDistanceToNow(s.updatedAt, { addSuffix: true }),
            href: `/chat/${s.id}`,
            active: s.id === activeId,
            actions: [],
            deleteAction: {
              confirmationValue: s.title || "conversation",
              submitAction: async () => {
                await deleteMutation.mutateAsync({ sessionId: s.id });
              },
            },
          })),
        },
      ]}
      footerButton={{
        onClick: () => router.push("/chat"),
        children: (
          <>
            <Plus />
            <span>New chat</span>
          </>
        ),
      }}
    />
  );
}
