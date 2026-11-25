import { db } from "@openstatus/db";

async function writesOutsideTheTransaction(ctx: ServiceContext) {
  await emitAudit(db, ctx, {}); // expect: services-audit-on-tx
  await emitAudit(ctx.db, ctx, {}); // expect: services-audit-on-tx
}

// A plain db handle is not the transaction, even as a parameter.
async function writesOnDbParameter(db: DB, ctx: ServiceContext) {
  await emitAudit(db, ctx, {}); // expect: services-audit-on-tx
}

async function writesOnCtx(ctx: ServiceContext) {
  requireScope(ctx, "monitors:write");
  return withTransaction(ctx, async (_tx) => {
    await emitAudit(ctx, ctx, {}); // expect: services-audit-on-tx
  });
}
