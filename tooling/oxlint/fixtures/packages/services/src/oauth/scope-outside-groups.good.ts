// Not a group folder: the rule has no group to compare against.
function anyGroup(ctx: ServiceContext) {
  requireScope(ctx, "pages:write");
}
