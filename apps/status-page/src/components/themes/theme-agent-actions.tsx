"use client";

import { Agent } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";

import { generateThemePrompt } from "../../lib/theme-prompt";
import { useThemeBuilder } from "./theme-builder-provider";

/** Copies a prompt carrying the builder theme for the user's own agent. */
export function ThemePromptButton({
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { theme } = useThemeBuilder();
  const { copy } = useCopyToClipboard();
  return (
    <Button
      variant="outline"
      {...props}
      onClick={(e) => {
        copy(generateThemePrompt(theme), {
          withToast: "Prompt copied, paste it into your agent",
        });
        onClick?.(e);
      }}
    >
      <Agent className="size-4" />
      Copy prompt
    </Button>
  );
}
