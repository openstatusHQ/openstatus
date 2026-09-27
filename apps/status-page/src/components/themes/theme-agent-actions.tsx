"use client";

import { Agent, Copy, Terminal } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@openstatus/ui/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";

import {
  generateThemePrompt,
  THEME_SKILL_INSTALL_COMMAND,
} from "../../lib/theme-prompt";
import { useThemeBuilder } from "./theme-builder-provider";

/** Copies a prompt carrying the builder theme for the user's own agent. */
export function ThemePromptButton(props: React.ComponentProps<typeof Button>) {
  const { theme } = useThemeBuilder();
  const { copy } = useCopyToClipboard();
  return (
    <Button
      variant="outline"
      {...props}
      onClick={() =>
        copy(generateThemePrompt(theme), {
          withToast: "Prompt copied, paste it into your agent",
        })
      }
    >
      <Agent className="size-4" />
      Copy prompt
    </Button>
  );
}

export function ThemeSkillInstallCommand({
  className,
}: {
  className?: string;
}) {
  const { copy } = useCopyToClipboard();
  return (
    <ButtonGroup className={cn("w-full", className)}>
      <ButtonGroupText className="min-w-0 flex-1 justify-start gap-1.5 px-2 font-mono text-[11px]">
        <Terminal className="size-3.5 shrink-0" />
        <span className="truncate">{THEME_SKILL_INSTALL_COMMAND}</span>
      </ButtonGroupText>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={() =>
              copy(THEME_SKILL_INSTALL_COMMAND, {
                withToast: "Install command copied",
              })
            }
          >
            <Copy className="size-3.5" />
            <span className="sr-only">Copy install command</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Install the openstatus-theme skill
        </TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
