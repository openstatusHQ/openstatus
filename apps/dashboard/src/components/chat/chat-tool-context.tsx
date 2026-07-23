"use client";

import { type ReactNode, createContext, useContext } from "react";

type ChatToolContextValue = {
  /** `approvalId` is the SDK's `approval.id`, NOT `toolCallId`. */
  confirmTool: (approvalId: string) => void;
  cancelTool: (approvalId: string, reason?: string) => void;
};

const ChatToolContext = createContext<ChatToolContextValue | null>(null);

export function ChatToolProvider({
  value,
  children,
}: {
  value: ChatToolContextValue;
  children: ReactNode;
}) {
  return (
    <ChatToolContext.Provider value={value}>
      {children}
    </ChatToolContext.Provider>
  );
}

export type { ChatToolContextValue };

export function useChatTool(): ChatToolContextValue {
  const ctx = useContext(ChatToolContext);
  if (!ctx) {
    throw new Error("useChatTool must be used within <ChatToolProvider>");
  }
  return ctx;
}
