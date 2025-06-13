import { FormCardGroup } from "@/components/forms/form-card";
import { FormGeneral } from "./form-general";
import { FormMonitors } from "./form-monitors";
import { FormCustomDomain } from "./form-custom-domain";
import { FormPasswordProtection } from "./form-password-protection";
import { FormDangerZone } from "./form-danger-zone";

export function FormStatusPageUpdate() {
  return (
    <FormCardGroup>
      <FormGeneral />
      <FormMonitors />
      <FormCustomDomain />
      <FormPasswordProtection />
      <FormDangerZone />
    </FormCardGroup>
  );
}
