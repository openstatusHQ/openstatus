import { TextShimmer } from "@openstatus/ui/components/custom/text-shimmer";
import type { UIMessage } from "ai";
import { useEffect } from "react";

import { Message, MessageContent, MessageMarkdown } from "./chat-message";
import { ChatToolPart } from "./chat-tool-part";

type Props = {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  // Keyed on `approvalId` (not `toolCallId`) since the SDK approval
  // flow resolves via `addToolApprovalResponse({ id: approvalId, … })`.
  // See `chat-tool-part.tsx` for where this id is read off the part.
  onConfirmTool: (args: {
    approvalId: string;
    toolName: string;
    input: unknown;
  }) => void;
  onCancelTool: (args: { approvalId: string; toolName: string }) => void;
};

export function ChatConversation({
  messages,
  status,
  onConfirmTool,
  onCancelTool,
}: Props) {
  // Pin the WINDOW (not an inner container) to the bottom on every
  // change. With the chat surface flowing in normal block layout there
  // is no inner overflow container; the window is the scroll target.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are change triggers, not reads
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: document.body.scrollHeight });
  }, [messages, status]);

  // Show the "Thinking" shimmer when we're waiting on the model and the
  // last visible message is the user's prompt — i.e. no assistant tokens
  // have streamed yet. Once tokens arrive the assistant message takes
  // over and the indicator is hidden.
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
            // Fallback to the array index when `id` is empty — older
            // persisted rows can have `id: ""` because the SDK didn't
            // always emit one before we set `generateMessageId`.
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
                  if (
                    typeof part.type === "string" &&
                    part.type.startsWith("tool-")
                  ) {
                    return (
                      <ChatToolPart
                        key={idx}
                        part={part as never}
                        onConfirm={onConfirmTool}
                        onCancel={onCancelTool}
                      />
                    );
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
    if (typeof part.type === "string" && part.type.startsWith("tool-")) {
      return true;
    }
  }
  return false;
}
