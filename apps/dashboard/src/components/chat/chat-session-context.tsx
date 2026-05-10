"use client";

import { useParams } from "next/navigation";
import { type ReactNode, createContext, useContext } from "react";

type ChatSessionContextValue = {
  sessionId: number | undefined;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ id?: string | string[] }>();
  const urlSessionId =
    typeof params.id === "string" ? Number.parseInt(params.id, 10) : undefined;

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
