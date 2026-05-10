"use client";

import { useChat } from "@ai-sdk/react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DefaultChatTransport,
  type UIMessage,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { ChatConversation } from "./chat-conversation";
import { ChatHistory } from "./chat-history";
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
    addToolApprovalResponse,
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
    // Approval flow: the SDK pauses with `state: "approval-requested"`
    // for destructive tools. Once the user resolves every pending
    // approval (`approval-responded`), `lastAssistantMessageIsCompleteWithApprovalResponses`
    // returns true and we resubmit so the server can run `execute`
    // (approve) or just emit the denied result (deny). Cancellation
    // is a first-class state — no custom predicate needed, no retry
    // loop possible.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
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

  // The SDK approval flow handles execute server-side once we resolve
  // the approval. There is no client-side tool POST anymore — the next
  // stream (auto-fired by `lastAssistantMessageIsCompleteWithApprovalResponses`)
  // delivers the tool result.
  const onConfirmTool = useCallback(
    (args: { approvalId: string; toolName: string; input: unknown }) => {
      addToolApprovalResponse({ id: args.approvalId, approved: true });
    },
    [addToolApprovalResponse],
  );

  const onCancelTool = useCallback(
    (args: { approvalId: string; toolName: string }) => {
      addToolApprovalResponse({
        id: args.approvalId,
        approved: false,
        reason: "Cancelled by user.",
      });
    },
    [addToolApprovalResponse],
  );

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
          <ChatSuggestions onSelect={onSubmit} />
          <ChatHistory />
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
          {/* `error.message` carries the server's body when the SDK
              decoded a JSON error response. Pattern-match for "Rate
              limit" so the user sees something actionable instead of
              the generic fallback. */}
          {/Rate limit/i.test(error.message ?? "")
            ? "You've hit the daily message cap — try again tomorrow."
            : "The assistant encountered an error. Try again."}
        </div>
      ) : null}
      <ChatPromptInput onSubmit={onSubmit} status={status} onStop={stop} />
    </div>
  );
}
