"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { SidebarRight } from "@/components/nav/sidebar-right";
import { useTRPC } from "@/lib/trpc/client";

export function Sidebar() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const activeId =
    typeof params.id === "string" ? Number.parseInt(params.id, 10) : undefined;

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: sessions } = useQuery(trpc.chatSession.list.queryOptions());

  const deleteMutation = useMutation(
    trpc.chatSession.delete.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.chatSession.list.queryKey(),
        });
        // If the deleted session was the one we were on, drop back to
        // the empty-state landing page.
        if (variables.sessionId === activeId) router.push("/chat");
      },
    }),
  );

  return (
    <SidebarRight
      header="Conversations"
      defaultOpen
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
            action: {
              icon: Trash2,
              label: "Delete conversation",
              onClick: () => deleteMutation.mutate({ sessionId: s.id }),
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
