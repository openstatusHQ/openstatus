const TEXT_LINK_SOURCE = "@/components/common/link";

function jsxName(name) {
  if (name?.type === "JSXIdentifier") return name.name;
  if (name?.type === "JSXMemberExpression") {
    return `${jsxName(name.object)}.${name.property.name}`;
  }
  return null;
}

/** JSX elements an expression can evaluate to, through `?:`, `&&`, `||` and `??`. */
function expressionElements(expr) {
  if (!expr) return [];
  switch (expr.type) {
    case "JSXElement":
      return [expr];
    case "ConditionalExpression":
      return [
        ...expressionElements(expr.consequent),
        ...expressionElements(expr.alternate),
      ];
    case "LogicalExpression":
      return [
        ...expressionElements(expr.left),
        ...expressionElements(expr.right),
      ];
    case "ParenthesizedExpression":
      return expressionElements(expr.expression);
    default:
      return [];
  }
}

/** The elements a Slot host could end up rendering from its children. */
function slotCandidates(children) {
  const elements = [];
  for (const child of children) {
    if (child.type === "JSXElement") elements.push(child);
    if (child.type === "JSXExpressionContainer") {
      elements.push(...expressionElements(child.expression));
    }
  }
  return elements;
}

/**
 * `@/components/common/link` is the inline text link: it adds a dashed hover
 * underline. Under `asChild`, Radix's Slot merges those classes into the host
 * (a Button, a DropdownMenuItem, ...), so the control underlines on hover.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "An `asChild` element must not wrap the text Link from @/components/common/link.",
    },
    messages: {
      textLink:
        '`<{{parent}} asChild>` wraps the text `Link` from @/components/common/link, which adds a dashed hover underline. Use `next/link` here (alias it, e.g. `import NextLink from "next/link"`, if the file also has inline text links), and add `target="_blank" rel="noopener noreferrer"` yourself for external hrefs.',
    },
  },
  create(context) {
    const textLinkNames = new Set();
    return {
      // Collected up front so JSX above the import is checked too.
      Program(node) {
        textLinkNames.clear();
        for (const statement of node.body) {
          if (statement.type !== "ImportDeclaration") continue;
          if (statement.source?.value !== TEXT_LINK_SOURCE) continue;
          for (const specifier of statement.specifiers) {
            if (
              specifier.type === "ImportSpecifier" &&
              specifier.imported?.name === "Link"
            ) {
              textLinkNames.add(specifier.local.name);
            }
          }
        }
      },
      JSXElement(node) {
        if (textLinkNames.size === 0) return;
        const opening = node.openingElement;
        const asChild = opening.attributes.some(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name?.name === "asChild" &&
            // `asChild={false}` renders the host itself.
            !(
              attr.value?.type === "JSXExpressionContainer" &&
              attr.value.expression?.type === "Literal" &&
              attr.value.expression.value === false
            ),
        );
        if (!asChild) return;
        // Slot renders its single element child, which may be picked by a
        // conditional: `{external ? <Link .../> : <Link .../>}`.
        for (const element of slotCandidates(node.children)) {
          const name = jsxName(element.openingElement.name);
          if (!textLinkNames.has(name)) continue;
          context.report({
            node: element,
            messageId: "textLink",
            data: { parent: jsxName(opening.name) ?? "element" },
          });
        }
      },
    };
  },
};
