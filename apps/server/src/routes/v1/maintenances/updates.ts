import { type db, desc, eq } from "@openstatus/db";
import { maintenanceUpdate } from "@openstatus/db/src/schema/maintenances";
import { latestMaintenanceUpdate } from "@openstatus/services/maintenance";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The public `message`: newest update, or the deprecated column. */
export function withLatestMessage<
  T extends {
    message: string;
    maintenanceUpdates: Array<{ id: number; date: Date; message: string }>;
  },
>(record: T): T {
  return {
    ...record,
    message:
      latestMaintenanceUpdate(record.maintenanceUpdates)?.message ??
      record.message,
  };
}

/** `message` on PUT edits the newest update; a bare row gets one dated now. */
export async function rewriteLatestUpdate(
  tx: Tx,
  maintenanceId: number,
  message: string,
  actorUserId: number | null,
): Promise<void> {
  const latest = await tx
    .select({ id: maintenanceUpdate.id })
    .from(maintenanceUpdate)
    .where(eq(maintenanceUpdate.maintenanceId, maintenanceId))
    .orderBy(desc(maintenanceUpdate.date), desc(maintenanceUpdate.id))
    .limit(1)
    .get();
  if (latest) {
    await tx
      .update(maintenanceUpdate)
      .set({ message, updatedAt: new Date(), updatedBy: actorUserId })
      .where(eq(maintenanceUpdate.id, latest.id))
      .run();
    return;
  }
  await tx
    .insert(maintenanceUpdate)
    .values({
      maintenanceId,
      message,
      date: new Date(),
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .run();
}
