export async function listMembers(args: { ctx: ServiceContext }) {
  requireScope(args.ctx, "admin");
  return args;
}

export async function countMembers(ctx: ServiceContext) {
  requireScope(ctx, "admin");
  return ctx;
}

// Runs inside the caller's transaction; the caller checks the scope.
export async function removeMemberInTx(args: { tx: DB; ctx: ServiceContext }) {
  return args;
}
