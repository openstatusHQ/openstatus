import { calleeName, isDbWrite, lateRequireScope } from "../lib/ast.js";
import {
  takesServiceContext,
  bodyRequiredScopes,
} from "../lib/scope-groups.js";

// `args: { tx: DB; ctx; ... }`: a helper inside the caller's transaction,
// which owns the scope check (as with services-mutation-guards).
function takesTransaction(param) {
  const annotation = param?.typeAnnotation?.typeAnnotation;
  return (
    annotation?.type === "TSTypeLiteral" &&
    annotation.members.some(
      (m) => m.type === "TSPropertySignature" && m.key?.name === "tx",
    )
  );
}

// services-mutation-guards owns anything that writes; reporting it here too
// would flag one defect twice.
function writes(node) {
  if (!node || typeof node.type !== "string") return false;
  if (
    node.type === "CallExpression" &&
    (calleeName(node) === "withTransaction" || isDbWrite(node))
  ) {
    return true;
  }
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const value = node[key];
    if (Array.isArray(value) ? value.some(writes) : writes(value)) return true;
  }
  return false;
}

const READ_VERB_PREFIX = /^(list|get|search|stream|preview)[A-Z]/;
// Only these probe or send, so only they may require a `:write` scope.
const MAY_WRITE_PREFIX = /^(stream|preview)[A-Z]/;

/**
 * Keys off shape, not name or folder: every exported function taking
 * `ctx: ServiceContext` acts for an actor, so it must check the actor's scope
 * before anything else. Writes are also covered by services-mutation-guards;
 * this rule catches the reads no transaction gives away.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "An exported services function taking ctx: ServiceContext must call requireScope first.",
    },
    messages: {
      missing:
        "`{{name}}` acts on behalf of an actor but never calls `requireScope`. Every verb requires a scope as its first line — see packages/services/AGENTS.md. If this export is not an actor-facing verb, disable this rule inline with the reason above it.",
      writeScope:
        "`{{name}}` is a read verb but requires `{{scope}}`. `get`/`list`/`search` verbs require `<group>:read`; only `stream`/`preview` verbs that probe or send may require `:write`.",
      late: "`{{name}}` runs code before `requireScope`. Check the scope first, before parsing input or reading anything; only destructuring the arguments may precede it.",
    },
  },
  create(context) {
    function check(fn, name) {
      if (!name || !takesServiceContext(fn.params[0])) return;
      if (takesTransaction(fn.params[0]) || writes(fn.body)) return;
      const scopes = bodyRequiredScopes(fn);
      if (scopes.length === 0) {
        context.report({ node: fn, messageId: "missing", data: { name } });
        return;
      }
      if (READ_VERB_PREFIX.test(name) && !MAY_WRITE_PREFIX.test(name)) {
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
