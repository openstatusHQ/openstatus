"use client";

import { useCallback, useMemo } from "react";

import { ChatConversation } from "./chat-conversation";
import { ChatErrorBanner } from "./chat-error-banner";
import { ChatErrorBoundary } from "./chat-error-boundary";
import { ChatPromptInput } from "./chat-prompt-input";
import {
  type ChatToolContextValue,
  ChatToolProvider,
} from "./chat-tool-context";
import { useChatSession } from "./use-chat-session";

export function ChatSessionClient({ sessionId }: { sessionId: number }) {
  const {
    messages,
    sendMessage,
    status,
    error,
    addToolApprovalResponse,
    stop,
  } = useChatSession({ sessionId });

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
        <ChatErrorBoundary>
          <ChatConversation messages={messages} status={status} />
        </ChatErrorBoundary>
        {error ? <ChatErrorBanner error={error} /> : null}
        <ChatPromptInput onSubmit={onSubmit} status={status} onStop={stop} />
      </div>
    </ChatToolProvider>
  );
}
