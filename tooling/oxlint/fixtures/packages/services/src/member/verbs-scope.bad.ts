// Outside the scope-group folders, any exported verb still needs a scope.
export async function listMembers(args: { ctx: ServiceContext }) { // expect: services-verbs-require-scope
  return args;
}

export async function countMembers(ctx: ServiceContext) { // expect: services-verbs-require-scope
  return ctx;
}
