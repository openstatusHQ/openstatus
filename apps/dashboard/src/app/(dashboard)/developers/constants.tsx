import type { IconType } from "@openstatus/icons";
import { ApiKey, Terminal } from "@openstatus/icons";

export const DEVELOPER_TABS: {
  value: string;
  label: string;
  icon: IconType;
  docs: string;
}[] = [
  {
    value: "api-keys",
    label: "API Keys",
    icon: ApiKey,
    docs: "https://api.openstatus.dev/openapi",
  },
  {
    value: "cli",
    label: "CLI",
    icon: Terminal,
    docs: "https://www.openstatus.dev/docs/reference/cli-reference",
  },
];

export const TERRAFORM_DOCS =
  "https://www.openstatus.dev/docs/reference/terraform";
