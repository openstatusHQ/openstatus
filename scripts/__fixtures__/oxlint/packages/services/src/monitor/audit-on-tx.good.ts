export async function deleteWidget(args: { ctx: ServiceContext }) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  return withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, {});
  });
}

async function deleteWidgetInTx(tx: DB, ctx: ServiceContext) {
  await emitAudit(tx, ctx, {});
}

async function removeWidgetInWorkspace(args: { tx: DB; ctx: ServiceContext }) {
  const { tx, ctx } = args;
  await emitAudit(tx, ctx, {});
}
