function readsGroup(ctx: ServiceContext) {
  requireScope(ctx, "notifications:read");
}

function admin(ctx: ServiceContext) {
  requireScope(ctx, "admin");
}

function anyCredential(ctx: ServiceContext) {
  requireScope(ctx, "any");
}
