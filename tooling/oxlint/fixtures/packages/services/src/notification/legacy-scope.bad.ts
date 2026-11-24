function readsAll(ctx: ServiceContext) {
  requireScope(ctx, "read"); // expect: services-no-legacy-scope
}

function writesAll(ctx: ServiceContext) {
  requireScope(ctx, "write"); // expect: services-no-legacy-scope
}

function dynamic(ctx: ServiceContext, scope: string) {
  requireScope(ctx, scope); // expect: services-no-legacy-scope
}

function numeric(ctx: ServiceContext) {
  requireScope(ctx, 123); // expect: services-no-legacy-scope
}
