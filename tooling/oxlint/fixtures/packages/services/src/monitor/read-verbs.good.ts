export async function listWidgets(args: { ctx: ServiceContext }) {
  requireScope(args.ctx, "monitors:read");
  return [];
}

export async function previewWidget({ ctx }: { ctx: ServiceContext }) {
  requireScope(ctx, "monitors:write");
  return ctx;
}

// No ServiceContext: a helper, not an actor-facing verb.
export async function listRows(db: DB) {
  return db;
}

async function getUnexported(args: { ctx: ServiceContext }) {
  return args;
}
