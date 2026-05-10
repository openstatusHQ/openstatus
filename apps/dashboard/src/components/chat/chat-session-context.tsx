"use client";

import { useParams } from "next/navigation";
import { type ReactNode, createContext, useContext } from "react";

type ChatSessionContextValue = {
  sessionId: number | undefined;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ id?: string | string[] }>();
  // Reject anything that isn't a clean positive integer string — `parseInt`
  // would otherwise truncate ("123abc" → 123) or yield NaN, leaking a
  // bogus sessionId into consumers (sidebar's `active` highlight, etc.).
  const urlSessionId =
    typeof params.id === "string" && /^[1-9]\d*$/.test(params.id)
      ? Number.parseInt(params.id, 10)
      : undefined;

  return (
    <ChatSessionContext.Provider value={{ sessionId: urlSessionId }}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSessionContext(): ChatSessionContextValue {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error(
      "useChatSessionContext must be used within <ChatSessionProvider>",
    );
  }
  return ctx;
}
