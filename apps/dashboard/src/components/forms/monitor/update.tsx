"use client";

import { FormCardGroup } from "@/components/forms/form-card";
import { FormGeneral } from "./form-general";
import { FormResponseTime } from "./form-response-time";
import { FormSchedulingRegions } from "./form-scheduling-regions";
import { FormOtel } from "./form-otel";
import { FormStatusPages } from "./form-status-pages";
import { FormNotifiers } from "./form-notifiers";
import { FormDangerZone } from "./form-danger-zone";
import { FormVisibility } from "./form-visibility";
import { FormRetry } from "./form-retry";
import { FormTags } from "./form-tags";

export function FormMonitorUpdate() {
  return (
    <FormCardGroup>
      <FormGeneral />
      <FormResponseTime />
      <FormTags />
      <FormSchedulingRegions />
      <FormStatusPages />
      <FormNotifiers />
      <FormRetry />
      <FormOtel />
      <FormVisibility />
      <FormDangerZone />
    </FormCardGroup>
  );
}
