import { FUNCTION_TYPES, calleeName, boundNames } from "../lib/ast.js";

// `tx`, `rtx`, `outerTx`: the transaction, not `ctx` or another db handle.
const TX_NAME = /^r?tx$|[a-z]Tx$/;
/**
 * The audit row must commit with the mutation: `emitAudit` takes the
 * transaction handed to the enclosing callback or `*InTx` helper (directly or
 * destructured from its args) and named for it, never the module `db`,
 * `ctx.db` or a `db` parameter. Member expressions (`opts.tx`) are rejected
 * on purpose.
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
        "`emitAudit` writes on `{{arg}}`, which is not a transaction parameter (`tx`) of an enclosing function, so the audit row may commit separately from the mutation. Pass the `tx` of the surrounding `withTransaction` callback or `*InTx` helper.",
    },
  },
  create(context) {
    const scopes = [];
    const visitor = {
      // `const { tx, ctx } = args;` keeps `tx` a parameter of the helper.
      VariableDeclarator(node) {
        const params = scopes.at(-1);
        if (!params || node.id?.type !== "ObjectPattern") return;
        const source = node.init?.type === "Identifier" ? node.init.name : null;
        if (!source || !scopes.some((scope) => scope.has(source))) {
          return;
        }
        boundNames(node.id, params);
      },
      CallExpression(node) {
        if (calleeName(node) !== "emitAudit") return;
        const arg = node.arguments[0];
        if (!arg) return;
        const name = arg.type === "Identifier" ? arg.name : null;
        if (name && TX_NAME.test(name) && scopes.some((p) => p.has(name))) {
          return;
        }
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
