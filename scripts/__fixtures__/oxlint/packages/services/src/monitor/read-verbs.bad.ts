export async function listWidgets(args: { ctx: ServiceContext }) { // expect: services-read-verbs-require-scope
  return [args];
}

export async function getWidget(args: { ctx: ServiceContext }) { // expect: services-read-verbs-require-scope
  requireScope(args.ctx, "pages:read");
  return null;
}

export const searchWidgets = async ({ ctx }: { ctx: ServiceContext }) => { // expect: services-read-verbs-require-scope
  return ctx;
};

// A nested helper's requireScope does not count.
export async function streamWidgets(args: { ctx: ServiceContext }) { // expect: services-read-verbs-require-scope
  const check = () => requireScope(args.ctx, "monitors:read");
  return check;
}
