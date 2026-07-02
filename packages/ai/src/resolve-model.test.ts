import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";

import { resolveChatModel } from "./resolve-model";

const ENV_KEYS = [
  "AI_BASE_URL",
  "AI_MODEL",
  "AI_API_KEY",
  "AI_GATEWAY_API_KEY",
];

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("resolveChatModel", () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  test("returns null when no provider is configured", () => {
    expect(resolveChatModel({ plan: "free" })).toBeNull();
  });

  test("gateway path: free plan resolves the cheaper model string", () => {
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    expect(resolveChatModel({ plan: "free" })).toBe(
      "anthropic/claude-haiku-4.5",
    );
  });

  test("gateway path: paid plan resolves the stronger model string", () => {
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    expect(resolveChatModel({ plan: "team" })).toBe(
      "anthropic/claude-sonnet-4.5",
    );
  });

  test("self-host path: AI_BASE_URL + AI_MODEL builds a model, plan ignored", () => {
    process.env.AI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.AI_API_KEY = "nvapi-test";
    process.env.AI_MODEL = "meta/llama-3.1-70b-instruct";
    const model = resolveChatModel({ plan: "free" });
    expect(model).not.toBeNull();
    expect(typeof model).toBe("object");
    expect((model as { modelId: string }).modelId).toBe(
      "meta/llama-3.1-70b-instruct",
    );
  });

  test("self-host path works without an API key (keyless local gateway)", () => {
    process.env.AI_BASE_URL = "http://localhost:11434/v1";
    process.env.AI_MODEL = "llama3.1";
    const model = resolveChatModel({ plan: "free" });
    expect(typeof model).toBe("object");
    expect((model as { modelId: string }).modelId).toBe("llama3.1");
  });

  test("self-host path takes priority over the gateway", () => {
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    process.env.AI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.AI_MODEL = "meta/llama-3.1-70b-instruct";
    expect(typeof resolveChatModel({ plan: "free" })).toBe("object");
  });

  test("AI_BASE_URL set but AI_MODEL missing returns null", () => {
    process.env.AI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    expect(resolveChatModel({ plan: "free" })).toBeNull();
  });

  test("whitespace-only env values are treated as unset", () => {
    process.env.AI_BASE_URL = "   ";
    process.env.AI_GATEWAY_API_KEY = "   ";
    expect(resolveChatModel({ plan: "free" })).toBeNull();
  });
});
