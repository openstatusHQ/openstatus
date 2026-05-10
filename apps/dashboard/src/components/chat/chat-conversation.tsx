import { TextShimmer } from "@openstatus/ui/components/custom/text-shimmer";
import { type UIMessage, isToolUIPart } from "ai";
import { useEffect } from "react";

import { Message, MessageContent, MessageMarkdown } from "./chat-message";
import { ChatToolPart } from "./chat-tool-part";

type Props = {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
};

export function ChatConversation({ messages, status }: Props) {
  // The chat surface has no inner overflow container — pin the window itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are change triggers, not reads
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: document.body.scrollHeight });
  }, [messages, status]);

  // Shimmer until the assistant emits its first token of the current turn.
  const last = messages[messages.length - 1];
  const showThinking =
    (status === "submitted" || status === "streaming") &&
    (last == null || last.role === "user" || !hasAssistantContent(last));

  return (
    <div className="flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        {messages.map((m, mIdx) => {
          const createdAt = (m as { createdAt?: number }).createdAt;
          const tooltip =
            createdAt != null
              ? new Date(createdAt).toLocaleString()
              : undefined;
          return (
            // Older persisted rows can have `id: ""` (pre-`generateMessageId`).
            <Message key={m.id || `msg-${mIdx}`} from={m.role} title={tooltip}>
              <MessageContent>
                {(m.parts ?? []).map((part, idx) => {
                  if (part.type === "text") {
                    if (m.role === "user") {
                      return (
                        <span key={idx} className="whitespace-pre-wrap">
                          {part.text}
                        </span>
                      );
                    }
                    return (
                      <MessageMarkdown key={idx}>{part.text}</MessageMarkdown>
                    );
                  }
                  if (isToolUIPart(part)) {
                    return <ChatToolPart key={idx} part={part} />;
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          );
        })}
        {showThinking ? <TextShimmer>Thinking…</TextShimmer> : null}
      </div>
    </div>
  );
}

function hasAssistantContent(m: UIMessage): boolean {
  if (m.role !== "assistant") return false;
  for (const part of m.parts ?? []) {
    if (
      part.type === "text" &&
      typeof (part as { text?: string }).text === "string" &&
      (part as { text: string }).text.length > 0
    ) {
      return true;
    }
    if (isToolUIPart(part)) {
      return true;
    }
  }
  return false;
}
