import { Enter, Stop, Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@openstatus/ui/components/ui/input-group";
import { Spinner } from "@openstatus/ui/components/ui/spinner";
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
      // IMEs (CJK input) finalize a candidate with Enter; don't submit mid-composition.
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
    <div className="bg-background sticky bottom-0 z-10 border-t px-3 pt-3 pb-2">
      <div className="mx-auto flex max-w-3xl flex-col gap-1">
        <form onSubmit={handleSubmit}>
          <InputGroup>
            <InputGroupTextarea
              placeholder="Ask openstatus…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              // Override the workspace `min-h-16` so an empty input is one row tall.
              className="min-h-0"
            />
            <InputGroupAddon
              align="block-end"
              className="justify-end px-2 py-2"
            >
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
                  <Stop className="size-4" />
                ) : status === "error" ? (
                  <Close className="size-4" />
                ) : (
                  <Enter className="size-4" />
                )}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <p className="text-muted-foreground text-center text-xs">
          Powered by Claude. AI responses may contain errors, double-check
          results.
        </p>
      </div>
    </div>
  );
}
