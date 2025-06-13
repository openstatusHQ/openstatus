"use client";

import { FormCardGroup } from "@/components/forms/form-card";
import { FormDangerZone } from "./form-danger-zone";
import { FormGeneral } from "./form-general";
import { FormNotifiers } from "./form-notifiers";
import { FormOtel } from "./form-otel";
import { FormResponseTime } from "./form-response-time";
import { FormRetry } from "./form-retry";
import { FormSchedulingRegions } from "./form-scheduling-regions";
import { FormStatusPages } from "./form-status-pages";
import { FormTags } from "./form-tags";
import { FormVisibility } from "./form-visibility";

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
