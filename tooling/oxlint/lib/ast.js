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
    !callee.computed &&
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

/** `requireScope` is synchronous and returns nothing, so only the bare statement form occurs. */
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
        isInertPattern(d.id) &&
        d.init?.type === "Identifier" &&
        params.has(d.init.name),
    )
  );
}

/** A pattern that runs no code: no computed keys, defaults only literals. */
function isInertPattern(pattern) {
  switch (pattern?.type) {
    case "Identifier":
      return true;
    case "ObjectPattern":
      return pattern.properties.every((p) =>
        p.type === "RestElement"
          ? isInertPattern(p.argument)
          : !p.computed && isInertPattern(p.value),
      );
    case "ArrayPattern":
      return pattern.elements.every((el) => el === null || isInertPattern(el));
    case "AssignmentPattern":
      return pattern.right?.type === "Literal" && isInertPattern(pattern.left);
    case "RestElement":
      return isInertPattern(pattern.argument);
    default:
      return false;
  }
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

/** Whether `inner` lies inside `outer` in the source. */
export function isWithin(inner, outer) {
  const [start, end] = inner.range ?? [inner.start, inner.end];
  const [outerStart, outerEnd] = outer.range ?? [outer.start, outer.end];
  return start >= outerStart && end <= outerEnd;
}

const WRITE_METHODS = new Set(["insert", "update", "delete"]);

/** Whether an expression is the db client: `db`, `defaultDb`, `ctx.db`, or a fallback between them. */
function isDbReceiver(expr) {
  switch (expr?.type) {
    case "Identifier":
      return expr.name === "db" || expr.name === "defaultDb";
    case "MemberExpression":
      return (
        !expr.computed &&
        expr.property?.type === "Identifier" &&
        expr.property.name === "db"
      );
    case "LogicalExpression":
      return isDbReceiver(expr.left) || isDbReceiver(expr.right);
    case "ConditionalExpression":
      return isDbReceiver(expr.consequent) || isDbReceiver(expr.alternate);
    case "ParenthesizedExpression":
    case "TSNonNullExpression":
    case "TSAsExpression":
      return isDbReceiver(expr.expression);
    default:
      return false;
  }
}

/**
 * `db.insert(...)`, `ctx.db.update(...)`, `(ctx.db ?? defaultDb).delete(...)`:
 * a write on the client itself. A `tx` receiver belongs to a caller's
 * transaction, and `Map#delete` or `Set#delete` has no db receiver.
 */
export function isDbWrite(node) {
  const callee = node.callee;
  return (
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.property?.type === "Identifier" &&
    WRITE_METHODS.has(callee.property.name) &&
    isDbReceiver(callee.object)
  );
}
