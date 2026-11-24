function readsGroup(ctx: ServiceContext) {
  requireScope(ctx, "notifications:read");
}

function admin(ctx: ServiceContext) {
  requireScope(ctx, "admin");
}

function anyCredential(ctx: ServiceContext) {
  requireScope(ctx, "any");
}

// A computed call is not a call to `requireScope`.
function computed(ctx: ServiceContext, checks: Record<string, Function>) {
  checks[requireScope](ctx, "read");
}
