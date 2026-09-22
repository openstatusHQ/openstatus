/**
 * Custom oxlint rules for openstatus.
 *
 * `services-mutation-guards` keys off behaviour, not filename: a top-level
 * function that opens a transaction is a mutation, and every mutation must
 * check the actor's scope and leave an audit row.
 *
 * It matches call names, not the call graph. `emitAudit` therefore counts from
 * anywhere in the verb (it belongs inside the `withTransaction` callback), which
 * a nested helper that never runs could satisfy. `requireScope` must appear in
 * the verb body itself, which is where the convention puts it. A guard, not a
 * proof — the audit tests are what actually pin the behaviour.
 */

const FUNCTION_TYPES = [
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
];

function calleeName(node) {
  const callee = node.callee;
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  // `foo.bar()` — only the property matters here.
  if (
    callee.type === "MemberExpression" &&
    callee.property?.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return null;
}

/** Arrows and function expressions have no `id`; fall back to the const they're assigned to. */
function functionName(node, assignedName) {
  if (node.id?.type === "Identifier") return node.id.name;
  return assignedName ?? "<anonymous>";
}

const servicesMutationGuards = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A services function that calls withTransaction must also call requireScope and emitAudit.",
    },
    messages: {
      missing:
        "`{{name}}` opens a transaction but never calls {{missing}}. Every mutation in @openstatus/services must check the actor's scope and emit an audit row — see packages/services/AGENTS.md. If this verb genuinely needs neither, disable this rule inline with the reason above it.",
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
        if (depth === 1) bodyCalls.add(name);
      },
    };
    for (const type of FUNCTION_TYPES) {
      visitor[type] = enter;
      visitor[`${type}:exit`] = exit;
    }
    return visitor;
  },
};

const DB_SCHEMA_BARREL = "@openstatus/db/src/schema";

/**
 * `"use client"` is a per-file directive, not a path convention, so this cannot
 * be expressed as a `no-restricted-imports` override keyed on globs.
 */
const noDbBarrelInClient = {
  meta: {
    type: "problem",
    docs: {
      description:
        'A "use client" file must not value-import the db schema barrel.',
    },
    messages: {
      barrel:
        'A "use client" file must not value-import `{{source}}` — it pulls drizzle and the whole schema graph into the browser bundle. Import the specific sub-path (e.g. `@openstatus/db/src/schema/monitors/constants`), or split the pure-zod part into a sibling file. `import type` is fine.',
    },
  },
  create(context) {
    let isClientFile = false;

    return {
      Program(node) {
        isClientFile = node.body.some(
          (statement) =>
            statement.type === "ExpressionStatement" &&
            statement.expression?.type === "Literal" &&
            statement.expression.value === "use client",
        );
      },
      ImportDeclaration(node) {
        if (!isClientFile) return;
        if (node.source?.value !== DB_SCHEMA_BARREL) return;
        if (node.importKind === "type") return;
        // `import { type Foo }` on every specifier erases too.
        const hasValueSpecifier = node.specifiers.some(
          (specifier) => specifier.importKind !== "type",
        );
        if (!hasValueSpecifier) return;

        context.report({
          node,
          messageId: "barrel",
          data: { source: DB_SCHEMA_BARREL },
        });
      },
    };
  },
};

export default {
  meta: { name: "openstatus" },
  rules: {
    "services-mutation-guards": servicesMutationGuards,
    "no-db-barrel-in-client": noDbBarrelInClient,
  },
};
