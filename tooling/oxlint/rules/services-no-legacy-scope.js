import { calleeName } from "../lib/ast.js";

const LEGACY_SCOPES = new Set(["read", "write"]);

/**
 * Verbs name their resource group; the bare umbrellas are what credentials
 * hold, never what a verb requires. Scoped to packages/services/src minus
 * src/auth in oxlint.config.ts.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        'requireScope must name a group scope, not the legacy "read"/"write" umbrella.',
    },
    messages: {
      legacy:
        'requireScope(ctx, "{{scope}}") is the legacy umbrella. Require the group instead: `<group>:read` / `<group>:write` for monitors, pages, incidents, notifications, subscribers, or `admin` — see packages/services/AGENTS.md.',
      nonLiteral:
        "requireScope takes a string literal so the required scope is visible at the call site and checkable by lint.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (calleeName(node) !== "requireScope") return;
        const arg = node.arguments[1];
        if (!arg) return;
        if (arg.type !== "Literal" || typeof arg.value !== "string") {
          context.report({ node: arg, messageId: "nonLiteral" });
          return;
        }
        if (!LEGACY_SCOPES.has(arg.value)) return;
        context.report({
          node: arg,
          messageId: "legacy",
          data: { scope: arg.value },
        });
      },
    };
  },
};
