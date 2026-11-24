export async function deleteWidget(args: { ctx: ServiceContext }) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  return withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, {});
  });
}

export function formatWidget(name: string) {
  return name.trim();
}

export async function renameWidget(args: { ctx: ServiceContext; input: unknown }) {
  const { ctx, input } = args;
  requireScope(ctx, "monitors:write");
  const parsed = RenameInput.parse(input);
  return withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, { parsed });
  });
}

export async function pageWidgets(args: { ctx: ServiceContext; limit?: number }) {
  const { ctx, limit = 50 } = args;
  requireScope(ctx, "monitors:write");
  return withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, { limit });
  });
}
