export async function listWidgets(args: { ctx: ServiceContext }) { // expect: services-read-verbs-require-scope
  return [args];
}

export async function getWidget(args: { ctx: ServiceContext }) {
  requireScope(args.ctx, "pages:read"); // expect: services-scope-matches-folder
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

export async function getParsedWidget(args: { ctx: ServiceContext; input: unknown }) {
  const input = GetWidgetInput.parse(args.input);
  requireScope(args.ctx, "monitors:read"); // expect: services-read-verbs-require-scope
  return input;
}

export async function getWidgetForEdit(args: { ctx: ServiceContext }) { // expect: services-read-verbs-require-scope
  requireScope(args.ctx, "monitors:write");
  return args;
}
