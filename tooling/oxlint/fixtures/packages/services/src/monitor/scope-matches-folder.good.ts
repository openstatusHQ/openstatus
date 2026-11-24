function ownGroup(ctx: ServiceContext) {
  requireScope(ctx, "monitors:read");
  requireScope(ctx, "monitors:write");
  requireScope(ctx, "admin");
  requireScope(ctx, "any");
}
