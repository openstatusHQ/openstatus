/** AST helpers shared by the openstatus oxlint rules. */

export const FUNCTION_TYPES = [
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
];

export function calleeName(node) {
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
export function functionName(node, assignedName) {
  if (node.id?.type === "Identifier") return node.id.name;
  return assignedName ?? "<anonymous>";
}

/** Every name a parameter list binds, through destructuring and defaults. */
export function boundNames(pattern, out = new Set()) {
  if (!pattern) return out;
  switch (pattern.type) {
    case "Identifier":
      out.add(pattern.name);
      break;
    case "ObjectPattern":
      for (const p of pattern.properties) {
        boundNames(p.type === "RestElement" ? p.argument : p.value, out);
      }
      break;
    case "ArrayPattern":
      for (const el of pattern.elements) boundNames(el, out);
      break;
    case "AssignmentPattern":
      boundNames(pattern.left, out);
      break;
    case "RestElement":
      boundNames(pattern.argument, out);
      break;
    case "TSParameterProperty":
      boundNames(pattern.parameter, out);
      break;
  }
  return out;
}

export function isRequireScopeStatement(statement) {
  return (
    statement.type === "ExpressionStatement" &&
    statement.expression?.type === "CallExpression" &&
    calleeName(statement.expression) === "requireScope"
  );
}

/** `const { ctx } = args;`: destructuring one of the function's own parameters. */
export function isParamDestructuring(statement, params) {
  return (
    statement.type === "VariableDeclaration" &&
    statement.declarations.every(
      (d) =>
        d.id?.type === "ObjectPattern" &&
        d.init?.type === "Identifier" &&
        params.has(d.init.name),
    )
  );
}

/**
 * The first body-level `requireScope` when something other than destructuring
 * the parameters runs before it; `null` when it comes first or is absent.
 */
export function lateRequireScope(fn) {
  if (fn.body?.type !== "BlockStatement") return null;
  const params = new Set();
  for (const p of fn.params) boundNames(p, params);
  const statements = fn.body.body;
  const first = statements.findIndex(isRequireScopeStatement);
  if (first <= 0) return null;
  const early = statements
    .slice(0, first)
    .every((statement) => isParamDestructuring(statement, params));
  return early ? null : statements[first];
}
