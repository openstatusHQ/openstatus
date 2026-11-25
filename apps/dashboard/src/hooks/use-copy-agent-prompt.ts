"use client";

import type { RouterInputs } from "@openstatus/api";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { AGENT_PROMPTS } from "@/config/agent-prompts";
import { useTRPC } from "@/lib/trpc/client";

export type AgentPromptSource =
  RouterInputs["track"]["agentPromptCopied"]["source"];

export function useCopyAgentPrompt(
  prompt: keyof typeof AGENT_PROMPTS,
  source: AgentPromptSource,
) {
  const trpc = useTRPC();
  const { copy, isCopied } = useCopyToClipboard();
  const track = useMutation(trpc.track.agentPromptCopied.mutationOptions());

  const copyPrompt = async () => {
    const ok = await copy(AGENT_PROMPTS[prompt], {
      withToast: "Prompt copied. Paste it into your agent.",
    });
    if (ok) track.mutate({ source, prompt });
    else toast.error("Could not copy the prompt");
  };

  return { copyPrompt, isCopied };
}
