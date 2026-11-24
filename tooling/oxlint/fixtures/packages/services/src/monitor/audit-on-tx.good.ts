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

// Destructured inside a nested callback from the outer function's args.
async function auditEach(args: { tx: DB; ctx: ServiceContext; ids: number[] }) {
  await Promise.all(
    args.ids.map(async () => {
      const { tx, ctx } = args;
      await emitAudit(tx, ctx, {});
    }),
  );
}

async function auditInOuterTx(outerTx: DB, ctx: ServiceContext) {
  await emitAudit(outerTx, ctx, {});
}
