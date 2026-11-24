import {
  FUNCTION_TYPES,
  calleeName,
  functionName,
  lateRequireScope,
  isWithin,
} from "../lib/ast.js";

/**
 * Keys off behaviour, not filename: a top-level function that opens a
 * transaction is a mutation, and every mutation must check the actor's scope
 * and leave an audit row.
 *
 * It matches call names, not the call graph. `emitAudit` therefore counts from
 * anywhere in the verb (it belongs inside the `withTransaction` callback), which
 * a nested helper that never runs could satisfy. `requireScope` must appear in
 * the verb body itself, which is where the convention puts it. A guard, not a
 * proof — the audit tests are what actually pin the behaviour.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "A services function that calls withTransaction must also call requireScope and emitAudit.",
    },
    messages: {
      missing:
        "`{{name}}` opens a transaction but never calls {{missing}}. Every mutation in @openstatus/services must check the actor's scope and emit an audit row — see packages/services/AGENTS.md. If this verb genuinely needs neither, disable this rule inline with the reason above it.",
      late: "`{{name}}` runs code before `requireScope`. Check the scope first, before parsing input or reading anything; only destructuring the arguments may precede it.",
    },
  },
  create(context) {
    let depth = 0;
    let outermost = null;
    let outermostName = null;
    let pendingName = null;
    // Anywhere in the verb, so a `withTransaction` callback's `emitAudit` counts.
    const calls = new Set();
    // The verb's own body, where `requireScope` belongs.
    const bodyCalls = new Set();

    function enter(node) {
      if (depth === 0) {
        outermost = node;
        outermostName = functionName(node, pendingName);
        pendingName = null;
        calls.clear();
        bodyCalls.clear();
      }
      depth += 1;
    }

    function exit() {
      depth -= 1;
      if (depth !== 0 || outermost === null) return;

      if (calls.has("withTransaction")) {
        const missing = [];
        if (!bodyCalls.has("requireScope")) missing.push("requireScope");
        if (!calls.has("emitAudit")) missing.push("emitAudit");

        if (missing.length > 0) {
          context.report({
            node: outermost,
            messageId: "missing",
            data: {
              name: outermostName,
              missing: missing.map((name) => `\`${name}\``).join(" or "),
            },
          });
        }
        const late = lateRequireScope(outermost);
        if (late) {
          context.report({
            node: late,
            messageId: "late",
            data: { name: outermostName },
          });
        }
      }
      outermost = null;
      outermostName = null;
      pendingName = null;
    }

    const visitor = {
      VariableDeclarator(node) {
        if (depth === 0 && node.id?.type === "Identifier") {
          pendingName = node.id.name;
        }
      },
      CallExpression(node) {
        const name = calleeName(node);
        if (!name) return;
        calls.add(name);
        // Parameter defaults run before the body, so they don't count as it.
        const inParams = outermost?.params.some((p) => isWithin(node, p));
        if (depth === 1 && !inParams) bodyCalls.add(name);
      },
    };
    for (const type of FUNCTION_TYPES) {
      visitor[type] = enter;
      visitor[`${type}:exit`] = exit;
    }
    return visitor;
  },
};
