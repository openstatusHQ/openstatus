"use client";

import { useCallback, useMemo } from "react";

import { ChatConversation } from "./chat-conversation";
import { ChatHistory } from "./chat-history";
import { ChatPromptInput } from "./chat-prompt-input";
import { ChatSuggestions } from "./chat-suggestions";
import {
  type ChatToolContextValue,
  ChatToolProvider,
} from "./chat-tool-context";
import { useChatSession } from "./use-chat-session";

export function ChatNewClient() {
  const {
    messages,
    sendMessage,
    status,
    error,
    addToolApprovalResponse,
    stop,
  } = useChatSession({ sessionId: undefined });

  const onSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage({ text });
    },
    [sendMessage],
  );

  const tool = useMemo<ChatToolContextValue>(
    () => ({
      confirmTool: (approvalId) =>
        addToolApprovalResponse({ id: approvalId, approved: true }),
      cancelTool: (approvalId, reason = "Cancelled by user.") =>
        addToolApprovalResponse({
          id: approvalId,
          approved: false,
          reason,
        }),
    }),
    [addToolApprovalResponse],
  );

  return (
    <ChatToolProvider value={tool}>
      <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
            <ChatSuggestions onSelect={onSubmit} />
            <ChatHistory />
          </div>
        ) : (
          <ChatConversation messages={messages} status={status} />
        )}
        {error ? (
          <div className="border-t bg-destructive/10 px-4 py-2 text-destructive text-sm">
            {/Rate limit/i.test(error.message ?? "")
              ? "You've hit the daily message cap — try again tomorrow."
              : "The assistant encountered an error. Try again."}
          </div>
        ) : null}
        <ChatPromptInput onSubmit={onSubmit} status={status} onStop={stop} />
      </div>
    </ChatToolProvider>
  );
}
