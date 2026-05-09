import { Button } from "@openstatus/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@openstatus/ui/components/ui/input-group";
import { Spinner } from "@openstatus/ui/components/ui/spinner";
import { CornerDownLeftIcon, SquareIcon, XIcon } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useState,
} from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

type Props = {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  status?: ChatStatus;
};

/**
 * Minimal chat prompt input. Owns the textarea + submit/stop button —
 * replaces the AI Elements `PromptInput` family which dragged in
 * file-attachment / voice / action-menu code we don't use, plus
 * `nanoid` for ids.
 *
 * Submit semantics:
 *  - Enter submits (composition-safe; Shift+Enter inserts a newline).
 *  - While the model is streaming/submitted the button becomes a stop
 *    square and clicking it calls `onStop` rather than submitting.
 */
export function ChatPromptInput({ onSubmit, onStop, status }: Props) {
  const [value, setValue] = useState("");
  const isGenerating = status === "submitted" || status === "streaming";

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || isGenerating) return;
    onSubmit(text);
    setValue("");
  }, [value, isGenerating, onSubmit]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Composition-safe: IMEs (CJK input) finalize a candidate via
      // Enter; we don't want to submit mid-composition.
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const handleClick = useCallback(() => {
    if (isGenerating && onStop) {
      onStop();
    }
  }, [isGenerating, onStop]);

  return (
    <div className="sticky bottom-0 z-10 border-t bg-background px-4 py-3">
      <form className="mx-auto max-w-3xl" onSubmit={handleSubmit}>
        <InputGroup>
          <InputGroupTextarea
            placeholder="Ask about your workspace…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            // Drop the workspace `min-h-16` so an empty input is one row
            // tall; `field-sizing-content` keeps autosize for multi-line.
            className="min-h-0"
          />
          <InputGroupAddon align="block-end" className="justify-end py-1">
            <Button
              type={isGenerating && onStop ? "button" : "submit"}
              size="icon-sm"
              onClick={handleClick}
              disabled={!isGenerating && !value.trim()}
              aria-label={isGenerating ? "Stop" : "Send"}
            >
              {status === "submitted" ? (
                <Spinner />
              ) : status === "streaming" ? (
                <SquareIcon className="size-4" />
              ) : status === "error" ? (
                <XIcon className="size-4" />
              ) : (
                <CornerDownLeftIcon className="size-4" />
              )}
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
