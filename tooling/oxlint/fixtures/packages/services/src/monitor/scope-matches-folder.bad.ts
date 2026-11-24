function crossesGroups(ctx: ServiceContext, withPages: boolean) {
  requireScope(ctx, "pages:write"); // expect: services-scope-matches-folder
  if (withPages) {
    requireScope(ctx, "incidents:read"); // expect: services-scope-matches-folder
  }
}
