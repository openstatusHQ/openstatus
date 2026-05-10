"use client";

import { useChat } from "@ai-sdk/react";
import type { ChatStoredMessage } from "@openstatus/db/src/schema";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DefaultChatTransport,
  type UIMessage,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useEffect, useMemo, useRef } from "react";

import { useTRPC } from "@/lib/trpc/client";
import { useChatSessionContext } from "./chat-session-context";

// `storedMessageSchema` validates writes, so persisted rows are already SDK-shaped.
function asUIMessages(
  rows: ChatStoredMessage[] | undefined,
): UIMessage[] | undefined {
  return rows as unknown as UIMessage[] | undefined;
}

/**
 * Owns the `useChat` instance plus session-id lifecycle: prop drives the
 * route-bound id (resets state on real navigation); a server-issued id
 * mid-stream is announced via `attachSession` so breadcrumb/sidebar
 * follow without a navigation that would unmount `useChat`.
 */
export function useChatSession({ sessionId }: { sessionId?: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { attachSession } = useChatSessionContext();

  const activeSession = useQuery(
    trpc.chatSession.get.queryOptions(
      sessionId !== undefined ? { sessionId } : skipToken,
    ),
  );

  // Ref so the transport closure sees mid-stream id changes without recreating `useChat`.
  const sessionIdRef = useRef<number | undefined>(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest({ messages, body }) {
          return {
            body: { ...body, messages, sessionId: sessionIdRef.current },
          };
        },
      }),
    [],
  );

  const chat = useChat({
    transport,
    id: sessionId !== undefined ? `chat-${sessionId}` : "chat-new",
    // Synchronous seed from the prefetched cache — without it the first render
    // is empty and the cache-miss effect below produces a visible flash.
    messages:
      sessionId !== undefined
        ? asUIMessages(activeSession.data?.messages)
        : undefined,
    // Resubmit once every approval has a response so the server runs `execute`
    // (approve) or emits `output-denied` (deny).
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.chatSession.list.queryKey(),
      });
      const id = sessionIdRef.current;
      if (id !== undefined) {
        queryClient.invalidateQueries({
          queryKey: trpc.chatSession.get.queryKey({ sessionId: id }),
        });
      }
    },
  });

  const { messages, setMessages } = chat;

  // Cache-miss fallback for soft nav (no prefetch). No-op when the seed above hit.
  useEffect(() => {
    if (sessionId === undefined) return;
    if (!activeSession.data?.messages) return;
    if (messages.length > 0) return;
    const next = asUIMessages(activeSession.data.messages);
    if (next) setMessages(next);
  }, [sessionId, activeSession.data, messages.length, setMessages]);

  // The server stamps the new id onto the first message's metadata; pluck it
  // for the transport ref and broadcast via the context (replaceState, no remount).
  useEffect(() => {
    if (sessionId !== undefined) return;
    if (sessionIdRef.current !== undefined) return;
    for (const m of messages) {
      const meta = (m as { metadata?: { sessionId?: number } }).metadata;
      if (meta?.sessionId != null) {
        sessionIdRef.current = meta.sessionId;
        attachSession(meta.sessionId);
        return;
      }
    }
  }, [messages, sessionId, attachSession]);

  return chat;
}
