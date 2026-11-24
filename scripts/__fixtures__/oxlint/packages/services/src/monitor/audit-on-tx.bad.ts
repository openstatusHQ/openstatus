import { db } from "@openstatus/db";

async function writesOutsideTheTransaction(ctx: ServiceContext) {
  await emitAudit(db, ctx, {}); // expect: services-audit-on-tx
  await emitAudit(ctx.db, ctx, {}); // expect: services-audit-on-tx
}
