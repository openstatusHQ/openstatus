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

// The caller owns the transaction, the scope check and the audit row.
async function renameWidgetInTx(tx: DB, id: number) {
  await tx.update(monitor).set({ name: "x" }).where(eq(monitor.id, id));
}

function forget(cache: Map<number, string>, id: number) {
  cache.delete(id);
}
