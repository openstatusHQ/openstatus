export async function deleteWidget(args: { ctx: ServiceContext }) { // expect: services-mutation-guards
  return withTransaction(args.ctx, async (tx) => tx);
}

// requireScope inside the callback is not in the verb body.
export async function updateWidget(args: { ctx: ServiceContext }) { // expect: services-mutation-guards
  return withTransaction(args.ctx, async (tx) => {
    requireScope(args.ctx, "monitors:write");
    await emitAudit(tx, args.ctx, {});
  });
}

export const createWidget = async (args: { ctx: ServiceContext }) => { // expect: services-mutation-guards
  requireScope(args.ctx, "monitors:write");
  return withTransaction(args.ctx, async (tx) => tx);
};

export async function renameWidget(args: { ctx: ServiceContext; input: unknown }) {
  const input = RenameInput.parse(args.input);
  requireScope(args.ctx, "monitors:write"); // expect: services-mutation-guards
  return withTransaction(args.ctx, async (tx) => {
    await emitAudit(tx, args.ctx, { input });
  });
}
