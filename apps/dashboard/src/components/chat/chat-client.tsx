"use client";

import { useChat } from "@ai-sdk/react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DefaultChatTransport,
  type UIMessage,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { ChatConversation } from "./chat-conversation";
import { ChatPromptInput } from "./chat-prompt-input";
import { ChatSuggestions } from "./chat-suggestions";

type Props = {
  /**
   * Active session id, threaded in via the `/chat/[id]` route. `undefined`
   * means we're on `/chat` (a fresh conversation that will create a new
   * session on the first user message).
   */
  sessionId?: number;
};

/**
 * Top-level chat surface. Uses the URL as the source of truth for the
 * active session — `/chat` for a fresh chat, `/chat/{id}` for an
 * existing one. After the first turn lands the route handler returns
 * the new session id via `message.metadata.sessionId`; we swap the
 * URL via `history.replaceState` so the component stays mounted (no
 * remount, no streaming hiccup).
 *
 * The conversations picker lives in the right-side `Sidebar` mounted
 * by `chat/layout.tsx`; this component is purely the message column.
 */
export function ChatClient({ sessionId }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const activeSession = useQuery(
    trpc.chatSession.get.queryOptions(
      sessionId !== undefined ? { sessionId } : skipToken,
    ),
  );

  // Stable ref so the transport closure picks up the latest sessionId
  // without recreating the `useChat` hook (which would reset state).
  // Sync only on prop change — the URL-swap effect below also writes
  // to this ref after the first turn, and a synchronous render write
  // would clobber that.
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

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    addToolOutput,
    stop,
  } = useChat({
    transport,
    id: sessionId !== undefined ? `chat-${sessionId}` : "chat-new",
    // Seed `useChat`'s initial state synchronously from the prefetched
    // session so the first render already has the persisted history.
    // Without this, `useChat`'s internal `messages` initializes to `[]`
    // and the React-Query cache only hydrates it via a follow-up
    // `setMessages` effect — producing an "empty then loaded" flash.
    messages:
      sessionId !== undefined
        ? (activeSession.data?.messages as unknown as UIMessage[] | undefined)
        : undefined,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.chatSession.list.queryKey(),
      });
      if (sessionIdRef.current !== undefined) {
        queryClient.invalidateQueries({
          queryKey: trpc.chatSession.get.queryKey({
            sessionId: sessionIdRef.current,
          }),
        });
      }
    },
  });

  // Cache-miss fallback: if the prefetch didn't seed the initial render
  // (e.g. soft client-side nav lands here before the query resolves),
  // sync once the data arrives. Cache-hit path (the prefetched layout
  // case) already has `messages` set via `useChat`'s `messages` prop —
  // this effect is a no-op there.
  useEffect(() => {
    if (sessionId === undefined) return;
    if (!activeSession.data?.messages) return;
    if (messages.length > 0) return;
    setMessages(activeSession.data.messages as unknown as never[]);
  }, [sessionId, activeSession.data, messages.length, setMessages]);

  // After the first turn the API attaches `{ sessionId }` to the start
  // chunk. Swap to `/chat/{id}` without remounting (history.replaceState
  // doesn't trigger Next.js routing). `swappedRef` guards against the
  // re-firing-effect → invalidate → re-render → re-fire loop.
  const swappedRef = useRef(false);
  useEffect(() => {
    if (sessionId !== undefined) {
      swappedRef.current = false;
      return;
    }
    if (swappedRef.current) return;
    for (const m of messages) {
      const meta = (m as { metadata?: { sessionId?: number } }).metadata;
      if (meta?.sessionId != null) {
        const id = meta.sessionId;
        swappedRef.current = true;
        sessionIdRef.current = id;
        window.history.replaceState({}, "", `/chat/${id}`);
        queryClient.invalidateQueries({
          queryKey: trpc.chatSession.list.queryKey(),
        });
        return;
      }
    }
  }, [messages, sessionId, queryClient, trpc.chatSession.list]);

  const onSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage({ text });
    },
    [sendMessage],
  );

  const onConfirmTool = useCallback(
    async (args: { toolCallId: string; toolName: string; input: unknown }) => {
      const res = await fetch("/api/chat/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolName: args.toolName,
          input: args.input,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        addToolOutput({
          toolCallId: args.toolCallId,
          tool: args.toolName,
          output: { error: body?.error ?? "Confirmation failed" },
        });
        return;
      }
      addToolOutput({
        toolCallId: args.toolCallId,
        tool: args.toolName,
        output: body.output,
      });
    },
    [addToolOutput],
  );

  const onCancelTool = useCallback(
    (args: { toolCallId: string; toolName: string }) => {
      addToolOutput({
        toolCallId: args.toolCallId,
        tool: args.toolName,
        output: { cancelled: true },
      });
    },
    [addToolOutput],
  );

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <ChatSuggestions onSelect={onSubmit} />
        </div>
      ) : (
        <ChatConversation
          messages={messages}
          status={status}
          onConfirmTool={onConfirmTool}
          onCancelTool={onCancelTool}
        />
      )}
      {error ? (
        <div className="border-t bg-destructive/10 px-4 py-2 text-destructive text-sm">
          The assistant encountered an error. Try again.
        </div>
      ) : null}
      <ChatPromptInput onSubmit={onSubmit} status={status} onStop={stop} />
    </div>
  );
}
