/** Scope-group helpers for the services rules. */

import { calleeName } from "./ast.js";

function isServiceContextType(annotation) {
  return (
    annotation?.type === "TSTypeReference" &&
    annotation.typeName?.type === "Identifier" &&
    annotation.typeName.name === "ServiceContext"
  );
}

/**
 * `args: { ctx: ServiceContext; ... }`, a destructured `{ ctx }`, or a
 * positional `ctx: ServiceContext`.
 */
export function takesServiceContext(param) {
  if (!param) return false;
  if (
    param.type === "Identifier" &&
    isServiceContextType(param.typeAnnotation?.typeAnnotation)
  ) {
    return true;
  }
  if (param.type === "ObjectPattern") {
    return param.properties.some(
      (p) =>
        p.type === "Property" &&
        p.key?.type === "Identifier" &&
        p.key.name === "ctx",
    );
  }
  if (param.type !== "Identifier" || param.name !== "args") return false;
  const annotation = param.typeAnnotation?.typeAnnotation;
  if (annotation?.type !== "TSTypeLiteral") return false;
  return annotation.members.some(
    (m) =>
      m.type === "TSPropertySignature" &&
      m.key?.type === "Identifier" &&
      m.key.name === "ctx" &&
      isServiceContextType(m.typeAnnotation?.typeAnnotation),
  );
}

/** Service folder → scope group, mirroring SCOPES.md. */
export const FOLDER_GROUP = {
  monitor: "monitors",
  "monitor-tag": "monitors",
  "private-location": "monitors",
  "monitor-incident": "monitors",
  "frozen-uptime": "monitors",
  "maintenance-window": "monitors",
  page: "pages",
  "page-component": "pages",
  "page-component-group": "pages",
  import: "pages",
  "status-report": "incidents",
  incident: "incidents",
  maintenance: "incidents",
  playbook: "incidents",
  notification: "notifications",
  "page-subscriber": "subscribers",
};

export function groupForFile(filename) {
  const m = /packages\/services\/src\/([^/]+)\//.exec(filename);
  return m ? FOLDER_GROUP[m[1]] : undefined;
}

/**
 * Direct statements of the function body only: a nested helper's call does
 * not count. Returns the required scopes found, so the caller can check the
 * group; a verb that probes (streamMonitorPreview) may require `:write`.
 */
export function bodyRequiredScopes(fn) {
  if (fn.body?.type !== "BlockStatement") return [];
  const scopes = [];
  for (const statement of fn.body.body) {
    const expr = statement.expression;
    if (
      statement.type === "ExpressionStatement" &&
      expr?.type === "CallExpression" &&
      calleeName(expr) === "requireScope"
    ) {
      const arg = expr.arguments[1];
      scopes.push(arg?.type === "Literal" ? arg.value : "<non-literal>");
    }
  }
  return scopes;
}
