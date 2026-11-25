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

// A default that parses runs before the scope check.
export async function moveWidget(args: { ctx: ServiceContext; input: unknown }) {
  const { ctx, input = MoveInput.parse(args) } = args;
  requireScope(ctx, "monitors:write"); // expect: services-mutation-guards
  return withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, { input });
  });
}

export async function tagWidget(args: { ctx: ServiceContext }) {
  const { [pickKey()]: ctx } = args;
  requireScope(ctx, "monitors:write"); // expect: services-mutation-guards
  return withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, {});
  });
}

// A default parameter runs before the body; it is not the verb's own check.
export async function archiveWidget( // expect: services-mutation-guards
  args: { ctx: ServiceContext },
  _checked = requireScope(args.ctx, "monitors:write"),
) {
  return withTransaction(args.ctx, async (tx) => {
    await emitAudit(tx, args.ctx, {});
  });
}

// Writes on the client itself, without opening a transaction.
export async function insertWidgetRaw(args: { ctx: ServiceContext }) { // expect: services-mutation-guards
  await db.insert(monitor).values({ workspaceId: args.ctx.workspace.id });
}

export async function renameWidgetRaw(args: { ctx: ServiceContext }) { // expect: services-mutation-guards
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  await (ctx.db ?? defaultDb).update(monitor).set({ name: "x" });
}
