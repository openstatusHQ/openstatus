import { calleeName } from "../lib/ast.js";
import { groupForFile } from "../lib/scope-groups.js";

/**
 * A group folder's verbs require that group. Cross-group verbs (an import
 * writing every entity) disable this inline and name the extra groups.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "A requireScope in a services group folder must name that folder's group.",
    },
    messages: {
      wrongGroup:
        "This file is in the `{{group}}` group but requires `{{scope}}`. Require `{{group}}:read` or `{{group}}:write`; a verb that genuinely spans groups disables this inline and names them.",
    },
  },
  create(context) {
    const group = groupForFile(context.filename ?? context.getFilename?.());
    if (!group) return {};
    return {
      CallExpression(node) {
        if (calleeName(node) !== "requireScope") return;
        const arg = node.arguments[1];
        if (arg?.type !== "Literal" || typeof arg.value !== "string") return;
        const [scopeGroup] = arg.value.split(":");
        if (!arg.value.includes(":") || scopeGroup === group) return;
        context.report({
          node: arg,
          messageId: "wrongGroup",
          data: { group, scope: arg.value },
        });
      },
    };
  },
};
