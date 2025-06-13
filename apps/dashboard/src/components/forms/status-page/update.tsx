import { FormCardGroup } from "@/components/forms/form-card";
import { FormCustomDomain } from "./form-custom-domain";
import { FormDangerZone } from "./form-danger-zone";
import { FormGeneral } from "./form-general";
import { FormMonitors } from "./form-monitors";
import { FormPasswordProtection } from "./form-password-protection";

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
