import { db as defaultDb } from "@openstatus/db";
import { externalServiceReport } from "@openstatus/db/src/schema";

import { NotFoundError } from "../errors";
import { getExternalServiceBySlug } from "../external-service";
import { getExternalComponentBySlug } from "../external-service-component";
import type { GlobalReadContext } from "../external-service/internal";
import { withBusyRetry } from "../retry";

export type RecordExternalReportInput = {
  slug: string;
  componentSlug?: string;
  reporterHash: string;
  country: string;
  now?: Date;
};

export type RecordExternalReportResult = {
  serviceSlug: string;
  componentId: number | null;
};

export async function recordExternalServiceReport(args: {
  ctx?: GlobalReadContext;
  input: RecordExternalReportInput;
}): Promise<RecordExternalReportResult> {
  const { ctx, input } = args;
  const db = ctx?.db ?? defaultDb;

  const service = await getExternalServiceBySlug({ ctx, slug: input.slug });
  if (!service || service.deletedAt != null) {
    throw new NotFoundError("External service");
  }

  let componentId: number | null = null;
  if (input.componentSlug) {
    const { component } = await getExternalComponentBySlug({
      ctx,
      serviceSlug: service.slug,
      componentSlug: input.componentSlug,
    });
    if (!component) {
      throw new NotFoundError("External service component");
    }
    componentId = component.id;
  }

  await withBusyRetry(() =>
    db
      .insert(externalServiceReport)
      .values({
        externalServiceId: service.id,
        externalServiceComponentId: componentId,
        reporterHash: input.reporterHash,
        country: input.country,
        createdAt: input.now ?? new Date(),
      })
      .run(),
  );

  return { serviceSlug: service.slug, componentId };
}
