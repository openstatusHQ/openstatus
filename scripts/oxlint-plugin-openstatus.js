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
 *
 * Every rule has a bad/good fixture pair in `scripts/__fixtures__/oxlint`,
 * checked by `pnpm check:lint-rules`. A new rule adds its pair there.
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

/** Every name a parameter list binds, through destructuring and defaults. */
function boundNames(pattern, out = new Set()) {
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

function isRequireScopeStatement(statement) {
  return (
    statement.type === "ExpressionStatement" &&
    statement.expression?.type === "CallExpression" &&
    calleeName(statement.expression) === "requireScope"
  );
}

/** `const { ctx } = args;`: destructuring one of the function's own parameters. */
function isParamDestructuring(statement, params) {
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
function lateRequireScope(fn) {
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
      late: "`{{name}}` runs code before `requireScope`. Check the scope first, before parsing input or reading anything; only destructuring the arguments may precede it.",
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
        const late = lateRequireScope(outermost);
        if (late) {
          context.report({
            node: late,
            messageId: "late",
            data: { name: outermostName },
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

const LEGACY_SCOPES = new Set(["read", "write"]);

/**
 * Verbs name their resource group; the bare umbrellas are what credentials
 * hold, never what a verb requires. Scoped to packages/services/src minus
 * src/auth in oxlint.config.ts.
 */
const servicesNoLegacyScope = {
  meta: {
    type: "problem",
    docs: {
      description:
        'requireScope must name a group scope, not the legacy "read"/"write" umbrella.',
    },
    messages: {
      legacy:
        'requireScope(ctx, "{{scope}}") is the legacy umbrella. Require the group instead: `<group>:read` / `<group>:write` for monitors, pages, incidents, notifications, subscribers, or `admin` — see packages/services/AGENTS.md.',
      nonLiteral:
        "requireScope takes a string literal so the required scope is visible at the call site and checkable by lint.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (calleeName(node) !== "requireScope") return;
        const arg = node.arguments[1];
        if (!arg) return;
        if (arg.type !== "Literal") {
          context.report({ node: arg, messageId: "nonLiteral" });
          return;
        }
        if (!LEGACY_SCOPES.has(arg.value)) return;
        context.report({
          node: arg,
          messageId: "legacy",
          data: { scope: arg.value },
        });
      },
    };
  },
};

const READ_VERB_PREFIX = /^(list|get|search|stream|preview)[A-Z]/;

/** `args: { ctx: ServiceContext; ... }`, or a destructured `{ ctx }`. */
function takesServiceContext(param) {
  if (!param) return false;
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
      m.typeAnnotation?.typeAnnotation?.type === "TSTypeReference" &&
      m.typeAnnotation.typeAnnotation.typeName?.type === "Identifier" &&
      m.typeAnnotation.typeAnnotation.typeName.name === "ServiceContext",
  );
}

/** Service folder → scope group, mirroring SCOPES.md. */
const FOLDER_GROUP = {
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
  notification: "notifications",
  "page-subscriber": "subscribers",
};

function groupForFile(filename) {
  const m = /packages\/services\/src\/([^/]+)\//.exec(filename);
  return m ? FOLDER_GROUP[m[1]] : undefined;
}

/**
 * Direct statements of the function body only: a nested helper's call does
 * not count. Returns the required scopes found, so the caller can check the
 * group; a verb that probes (streamMonitorPreview) may require `:write`.
 */
function bodyRequiredScopes(fn) {
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

/**
 * Read verbs have no transaction to key off, so this one keys off shape: an
 * exported list/get/search/stream/preview function taking `ctx: ServiceContext`.
 */
const servicesReadVerbsRequireScope = {
  meta: {
    type: "problem",
    docs: {
      description:
        "An exported read verb taking ctx: ServiceContext must call requireScope.",
    },
    messages: {
      missing:
        "`{{name}}` reads on behalf of an actor but never calls `requireScope`. Read verbs require `<group>:read` as their first line — see packages/services/AGENTS.md. If this export is not an actor-facing verb, disable this rule inline with the reason above it.",
      late: "`{{name}}` runs code before `requireScope`. Check the scope first, before parsing input or reading anything; only destructuring the arguments may precede it.",
    },
  },
  create(context) {
    function check(fn, name) {
      if (!name || !READ_VERB_PREFIX.test(name)) return;
      if (!takesServiceContext(fn.params[0])) return;
      if (bodyRequiredScopes(fn).length === 0) {
        context.report({ node: fn, messageId: "missing", data: { name } });
        return;
      }
      const late = lateRequireScope(fn);
      if (late)
        context.report({ node: late, messageId: "late", data: { name } });
    }
    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === "FunctionDeclaration") {
          check(decl, decl.id?.name);
          return;
        }
        if (decl.type !== "VariableDeclaration") return;
        for (const d of decl.declarations) {
          if (d.id?.type !== "Identifier" || !d.init) continue;
          if (
            d.init.type === "ArrowFunctionExpression" ||
            d.init.type === "FunctionExpression"
          ) {
            check(d.init, d.id.name);
          }
        }
      },
    };
  },
};

/**
 * A group folder's verbs require that group. Cross-group verbs (an import
 * writing every entity) disable this inline and name the extra groups.
 */
const servicesScopeMatchesFolder = {
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

/**
 * The audit row must commit with the mutation: `emitAudit` takes the
 * transaction handed to the enclosing callback or `*InTx` helper (directly or
 * destructured from its args), never the module `db` or `ctx.db`.
 */
const servicesAuditOnTx = {
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
const noTextLinkAsChild = {
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
      ImportDeclaration(node) {
        if (node.source?.value !== TEXT_LINK_SOURCE) return;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported?.name === "Link"
          ) {
            textLinkNames.add(specifier.local.name);
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

export default {
  meta: { name: "openstatus" },
  rules: {
    "services-mutation-guards": servicesMutationGuards,
    "services-no-legacy-scope": servicesNoLegacyScope,
    "services-read-verbs-require-scope": servicesReadVerbsRequireScope,
    "services-scope-matches-folder": servicesScopeMatchesFolder,
    "services-audit-on-tx": servicesAuditOnTx,
    "no-db-barrel-in-client": noDbBarrelInClient,
    "no-text-link-as-child": noTextLinkAsChild,
  },
};
