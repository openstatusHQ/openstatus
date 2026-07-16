import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import type { LanguageModel } from "ai";

// Hosted openstatus.dev defaults, resolved through the Vercel AI Gateway as
// bare model strings. Free workspaces get the cheaper model because we pay for
// their inference; this tiering applies ONLY to the gateway path.
const GATEWAY_MODEL_FREE = "anthropic/claude-haiku-4.5";
const GATEWAY_MODEL_PAID = "anthropic/claude-sonnet-4.5";

// `||` (not `??`) so empty / whitespace-only env values fall back instead of
// being passed through as a real value.
function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Resolve the chat model from environment, provider-agnostic.
 *
 *  1. Self-host (`AI_BASE_URL`): any OpenAI-compatible endpoint (NVIDIA NIM,
 *     vLLM, Ollama, OpenRouter, …). Single `AI_MODEL`; `plan` is ignored
 *     because the operator runs and pays for inference. `AI_API_KEY` is
 *     optional so keyless local gateways work. The model MUST support tool
 *     calling — the agent relies on it.
 *  2. Vercel AI Gateway (`AI_GATEWAY_API_KEY`): hosted default; `plan` selects
 *     the model. Unchanged behavior.
 *  3. Neither configured → `null` (caller returns 503).
 */
export function resolveChatModel({
  plan,
}: {
  plan: WorkspacePlan;
}): LanguageModel | null {
  const baseURL = readEnv("AI_BASE_URL");
  if (baseURL) {
    const model = readEnv("AI_MODEL");
    if (!model) return null;
    const provider = createOpenAICompatible({
      name: "self-hosted",
      baseURL,
      apiKey: readEnv("AI_API_KEY"),
    });
    return provider.chatModel(model);
  }

  if (readEnv("AI_GATEWAY_API_KEY")) {
    return plan === "free" ? GATEWAY_MODEL_FREE : GATEWAY_MODEL_PAID;
  }

  return null;
}
