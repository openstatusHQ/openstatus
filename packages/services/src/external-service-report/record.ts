import type { OSTinybird } from "@openstatus/tinybird";

import { NotFoundError } from "../errors";
import { getExternalServiceBySlug } from "../external-service";
import { getExternalComponentBySlug } from "../external-service-component";
import type { GlobalReadContext } from "../external-service/internal";

export type RecordExternalReportInput = {
  slug: string;
  componentSlug?: string;
  reporterHash: string;
  country: string;
  reportedAt: number;
};

export type RecordExternalReportResult = {
  serviceSlug: string;
  componentId: string;
};

export async function recordExternalServiceReport(args: {
  ctx?: GlobalReadContext;
  tb: OSTinybird;
  input: RecordExternalReportInput;
}): Promise<RecordExternalReportResult> {
  const { ctx, tb, input } = args;

  const service = await getExternalServiceBySlug({ ctx, slug: input.slug });
  if (!service || service.deletedAt != null) {
    throw new NotFoundError("External service");
  }

  let componentId = "";
  if (input.componentSlug) {
    const { component } = await getExternalComponentBySlug({
      ctx,
      serviceSlug: service.slug,
      componentSlug: input.componentSlug,
    });
    if (!component) {
      throw new NotFoundError("External service component");
    }
    componentId = String(component.id);
  }

  await tb.publishExternalReport({
    id: service.slug,
    component_id: componentId,
    reporter_hash: input.reporterHash,
    country: input.country,
    reported_at: input.reportedAt,
  });

  return { serviceSlug: service.slug, componentId };
}
