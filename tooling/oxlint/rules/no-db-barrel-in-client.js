const DB_SCHEMA_BARREL = "@openstatus/db/src/schema";

/**
 * `"use client"` is a per-file directive, not a path convention, so this cannot
 * be expressed as a `no-restricted-imports` override keyed on globs.
 */
export default {
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
      // A directive only counts in the prologue, before any other statement.
      Program(node) {
        isClientFile = false;
        for (const statement of node.body) {
          const isDirective =
            statement.type === "ExpressionStatement" &&
            statement.expression?.type === "Literal" &&
            typeof statement.expression.value === "string";
          if (!isDirective) break;
          if (statement.expression.value === "use client") isClientFile = true;
        }
      },
      ImportDeclaration(node) {
        if (!isClientFile) return;
        if (node.source?.value !== DB_SCHEMA_BARREL) return;
        if (node.importKind === "type") return;
        // `import { type Foo }` on every specifier erases too.
        const hasValueSpecifier = node.specifiers.some(
          (specifier) => specifier.importKind !== "type",
        );
        // A bare `import "…/schema"` still loads the whole barrel.
        if (node.specifiers.length > 0 && !hasValueSpecifier) return;

        context.report({
          node,
          messageId: "barrel",
          data: { source: DB_SCHEMA_BARREL },
        });
      },
    };
  },
};
