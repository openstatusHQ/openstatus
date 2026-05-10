"use client";

import { useParams } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ChatSessionContextValue = {
  sessionId: number | undefined;
  /** Replace the URL via `history.replaceState` (no Next.js navigation, so `useChat` stays mounted). */
  attachSession: (id: number) => void;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

/**
 * Single source of truth for the active session id across breadcrumb,
 * sidebar and runtime. `useParams` alone won't do — Next.js doesn't
 * observe `history.replaceState`, so a runtime-driven URL swap would
 * leave consumers stuck on the original route value.
 */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ id?: string | string[] }>();
  const urlSessionId =
    typeof params.id === "string" ? Number.parseInt(params.id, 10) : undefined;

  const [attachedId, setAttachedId] = useState<number | undefined>(undefined);

  // Real navigation (route change) wins — drop any prior attach so the
  // URL becomes the source of truth again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: urlSessionId is the change trigger, not a read
  useEffect(() => {
    setAttachedId(undefined);
  }, [urlSessionId]);

  const attachSession = useCallback((id: number) => {
    setAttachedId((prev) => (prev === id ? prev : id));
    window.history.replaceState({}, "", `/chat/${id}`);
  }, []);

  return (
    <ChatSessionContext.Provider
      value={{ sessionId: attachedId ?? urlSessionId, attachSession }}
    >
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
