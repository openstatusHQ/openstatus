import { FUNCTION_TYPES, calleeName, boundNames } from "../lib/ast.js";

/**
 * The audit row must commit with the mutation: `emitAudit` takes the
 * transaction handed to the enclosing callback or `*InTx` helper (directly or
 * destructured from its args), never the module `db` or `ctx.db`. Member
 * expressions (`opts.tx`) are rejected on purpose; passing a non-transaction
 * parameter such as `ctx` is left to the `DB` type of the first argument.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "emitAudit must write on the transaction passed to an enclosing function.",
    },
    messages: {
      notTx:
        "`emitAudit` writes on `{{arg}}`, which is not a parameter of an enclosing function, so the audit row commits separately from the mutation. Pass the `tx` of the surrounding `withTransaction` callback or `*InTx` helper.",
    },
  },
  create(context) {
    const scopes = [];
    const visitor = {
      // `const { tx, ctx } = args;` keeps `tx` a parameter of the helper.
      VariableDeclarator(node) {
        const params = scopes.at(-1);
        if (!params || node.id?.type !== "ObjectPattern") return;
        if (node.init?.type !== "Identifier" || !params.has(node.init.name)) {
          return;
        }
        boundNames(node.id, params);
      },
      CallExpression(node) {
        if (calleeName(node) !== "emitAudit") return;
        const arg = node.arguments[0];
        if (!arg) return;
        const name = arg.type === "Identifier" ? arg.name : null;
        if (name && scopes.some((params) => params.has(name))) return;
        context.report({
          node: arg,
          messageId: "notTx",
          data: { arg: context.sourceCode?.getText?.(arg) ?? name ?? "it" },
        });
      },
    };
    for (const type of FUNCTION_TYPES) {
      visitor[type] = (node) => {
        const params = new Set();
        for (const p of node.params) boundNames(p, params);
        scopes.push(params);
      };
      visitor[`${type}:exit`] = () => scopes.pop();
    }
    return visitor;
  },
};
