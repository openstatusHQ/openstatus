import { lateRequireScope } from "../lib/ast.js";
import {
  takesServiceContext,
  bodyRequiredScopes,
} from "../lib/scope-groups.js";

const READ_VERB_PREFIX = /^(list|get|search|stream|preview)[A-Z]/;
// Only these probe or send, so only they may require a `:write` scope.
const MAY_WRITE_PREFIX = /^(stream|preview)[A-Z]/;

/**
 * Read verbs have no transaction to key off, so this one keys off shape: an
 * exported list/get/search/stream/preview function taking `ctx: ServiceContext`.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "An exported read verb taking ctx: ServiceContext must call requireScope.",
    },
    messages: {
      missing:
        "`{{name}}` reads on behalf of an actor but never calls `requireScope`. Read verbs require `<group>:read` as their first line — see packages/services/AGENTS.md. If this export is not an actor-facing verb, disable this rule inline with the reason above it.",
      writeScope:
        "`{{name}}` is a read verb but requires `{{scope}}`. `get`/`list`/`search` verbs require `<group>:read`; only `stream`/`preview` verbs that probe or send may require `:write`.",
      late: "`{{name}}` runs code before `requireScope`. Check the scope first, before parsing input or reading anything; only destructuring the arguments may precede it.",
    },
  },
  create(context) {
    function check(fn, name) {
      if (!name || !READ_VERB_PREFIX.test(name)) return;
      if (!takesServiceContext(fn.params[0])) return;
      const scopes = bodyRequiredScopes(fn);
      if (scopes.length === 0) {
        context.report({ node: fn, messageId: "missing", data: { name } });
        return;
      }
      if (!MAY_WRITE_PREFIX.test(name)) {
        for (const scope of scopes) {
          if (!scope.endsWith(":write")) continue;
          context.report({
            node: fn,
            messageId: "writeScope",
            data: { name, scope },
          });
        }
      }
      const late = lateRequireScope(fn);
      if (late)
        context.report({ node: late, messageId: "late", data: { name } });
    }
    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === "FunctionDeclaration") {
          check(decl, decl.id?.name);
          return;
        }
        if (decl.type !== "VariableDeclaration") return;
        for (const d of decl.declarations) {
          if (d.id?.type !== "Identifier" || !d.init) continue;
          if (
            d.init.type === "ArrowFunctionExpression" ||
            d.init.type === "FunctionExpression"
          ) {
            check(d.init, d.id.name);
          }
        }
      },
    };
  },
};
