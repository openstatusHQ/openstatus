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
