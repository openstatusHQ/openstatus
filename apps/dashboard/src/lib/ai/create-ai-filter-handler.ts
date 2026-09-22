import { generateAIOutputSchema } from "@openstatus/ui/lib/data-table-filters/ai/output-schema";
import { generateAIPrompt } from "@openstatus/ui/lib/data-table-filters/ai/prompt";
import type { TableSchemaDefinition } from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { streamObject } from "ai";
import type { LanguageModel } from "ai";

export type AIFilterHandlerOptions = {
  model: LanguageModel;
  schema: TableSchemaDefinition;
};

/**
 * Creates a POST handler that streams AI-inferred filter state from a natural language query.
 *
 * The consumer provides a model and table schema. The handler generates the system prompt
 * and Zod output schema automatically, then streams the structured object response.
 *
 * The static schema description is cached via Anthropic's prompt caching
 * (`cache_control: { type: "ephemeral" }`). Only the dynamic timestamp and
 * user query are sent fresh on each request.
 *
 * @example
 * ```ts
 * import { createAnthropic } from "@ai-sdk/anthropic";
 * import { createAIFilterHandler } from "@/lib/ai/create-ai-filter-handler";
 * import { tableSchema } from "../table-schema";
 *
 * const anthropic = createAnthropic({
 *   baseURL: "https://ai-gateway.vercel.sh/v1",
 *   apiKey: process.env.AI_GATEWAY_API_KEY,
 * });
 *
 * export const POST = createAIFilterHandler({
 *   model: anthropic("anthropic/claude-opus-4.5"),
 *   schema: tableSchema.definition,
 * });
 * ```
 */
export function createAIFilterHandler({
  model,
  schema,
}: AIFilterHandlerOptions) {
  // Static prompt (cacheable) — generated once, same for every request
  const staticPrompt = generateAIPrompt(schema);
  const outputSchema = generateAIOutputSchema(schema);

  return async function POST(req: Request) {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query || query.length > 500) {
      return Response.json(
        { error: "Invalid query: must be a non-empty string (max 500 chars)" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    try {
      const result = streamObject({
        model,
        schema: outputSchema,
        messages: [
          {
            role: "system",
            content: staticPrompt,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          },
          {
            role: "user",
            content: `Current date/time: ${now}\n\nQuery: ${query}`,
          },
        ],
      });

      return result.toTextStreamResponse();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI filter inference failed";
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? (error.statusCode as number)
          : 500;

      return Response.json({ error: message }, { status });
    }
  };
}
