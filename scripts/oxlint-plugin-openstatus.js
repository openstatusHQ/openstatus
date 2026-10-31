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
      wrongGroup:
        "`{{name}}` lives in the `{{group}}` group but requires `{{scope}}`. Read verbs require `{{group}}:read` (or `{{group}}:write` when they probe or send).",
    },
  },
  create(context) {
    const group = groupForFile(context.filename ?? context.getFilename?.());
    function check(fn, name) {
      if (!name || !READ_VERB_PREFIX.test(name)) return;
      if (!takesServiceContext(fn.params[0])) return;
      const scopes = bodyRequiredScopes(fn);
      if (scopes.length === 0) {
        context.report({ node: fn, messageId: "missing", data: { name } });
        return;
      }
      if (!group) return;
      const allowed = new Set([`${group}:read`, `${group}:write`]);
      for (const scope of scopes) {
        if (allowed.has(scope)) continue;
        context.report({
          node: fn,
          messageId: "wrongGroup",
          data: { name, group, scope },
        });
      }
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

export default {
  meta: { name: "openstatus" },
  rules: {
    "services-mutation-guards": servicesMutationGuards,
    "services-no-legacy-scope": servicesNoLegacyScope,
    "services-read-verbs-require-scope": servicesReadVerbsRequireScope,
    "no-db-barrel-in-client": noDbBarrelInClient,
  },
};
