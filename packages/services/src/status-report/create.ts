import { and, eq } from "@openstatus/db";
import {
  page,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, NotFoundError } from "../errors";
import type { StatusReport, StatusReportUpdate } from "../types";
import {
  updatePageComponentAssociations,
  validatePageComponentIds,
} from "./internal";
import { CreateStatusReportInput } from "./schemas";

export type CreateStatusReportResult = {
  statusReport: StatusReport;
  initialUpdate: StatusReportUpdate;
};

export async function createStatusReport(args: {
  ctx: ServiceContext;
  input: CreateStatusReportInput;
}): Promise<CreateStatusReportResult> {
  const { ctx } = args;
  const input = CreateStatusReportInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const page_ = await tx
      .select({ id: page.id })
      .from(page)
      .where(
        and(eq(page.id, input.pageId), eq(page.workspaceId, ctx.workspace.id)),
      )
      .get();
    if (!page_) throw new NotFoundError("page", input.pageId);

    const validated = await validatePageComponentIds({
      tx,
      workspaceId: ctx.workspace.id,
      pageComponentIds: input.pageComponentIds,
    });

    if (validated.pageId !== null && validated.pageId !== input.pageId) {
      throw new ConflictError(
        `pageId ${input.pageId} does not match the page (${validated.pageId}) of the selected components.`,
      );
    }

    const newReport = await tx
      .insert(statusReport)
      .values({
        workspaceId: ctx.workspace.id,
        pageId: input.pageId,
        title: input.title,
        status: input.status,
      })
      .returning()
      .get();

    await updatePageComponentAssociations({
      tx,
      statusReportId: newReport.id,
      componentIds: validated.componentIds,
    });

    const initialUpdate = await tx
      .insert(statusReportUpdate)
      .values({
        statusReportId: newReport.id,
        status: input.status,
        date: input.date,
        message: input.message,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "status_report.create",
      entityType: "status_report",
      entityId: newReport.id,
      after: newReport,
    });

    return { statusReport: newReport, initialUpdate };
  });
}
