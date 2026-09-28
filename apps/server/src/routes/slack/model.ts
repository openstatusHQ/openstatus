// Vercel AI Gateway model id (`anthropic/<model>`). Override via
// SLACK_AGENT_MODEL when rolling out a new model version.
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

// `||` (not `??`) so empty / whitespace-only env values fall back to the
// default rather than being passed through to `generateText`.
export const SLACK_AGENT_MODEL =
  process.env.SLACK_AGENT_MODEL?.trim() || DEFAULT_MODEL;
