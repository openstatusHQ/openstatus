/**
 * Custom oxlint rules for openstatus.
 *
 * `services-mutation-guards` keys off behaviour, not filename: a top-level
 * function that opens a transaction is a mutation, and every mutation must
 * check the actor's scope and leave an audit row.
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

function functionName(node) {
  return node.id?.type === "Identifier" ? node.id.name : "<anonymous>";
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
    // Calls are recorded against the outermost function, so a `withTransaction`
    // callback's `emitAudit` still counts for the verb that owns it.
    let depth = 0;
    let outermost = null;
    const calls = new Set();

    function enter(node) {
      if (depth === 0) {
        outermost = node;
        calls.clear();
      }
      depth += 1;
    }

    function exit() {
      depth -= 1;
      if (depth !== 0 || outermost === null) return;

      if (calls.has("withTransaction")) {
        const missing = ["requireScope", "emitAudit"].filter(
          (name) => !calls.has(name),
        );
        if (missing.length > 0) {
          context.report({
            node: outermost,
            messageId: "missing",
            data: {
              name: functionName(outermost),
              missing: missing.map((name) => `\`${name}\``).join(" or "),
            },
          });
        }
      }
      outermost = null;
    }

    const visitor = {
      CallExpression(node) {
        const name = calleeName(node);
        if (name) calls.add(name);
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
