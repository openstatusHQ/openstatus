import type { IconProps, IconType } from "@openstatus/icons";
import { Terminal } from "@openstatus/icons";
import { ModelContextProtocolIcon, SlackIcon } from "@openstatus/icons/brand";

// brand icons take no `size` prop; map it to width/height so NavTabs/breadcrumb render them at 16px
function withSize(Icon: React.ComponentType<React.ComponentProps<"svg">>) {
  const Sized: IconType = ({
    size = 24,
    absoluteStrokeWidth: _,
    ...props
  }: IconProps) => <Icon {...props} width={size} height={size} />;
  return Sized;
}

export const AGENT_TABS: {
  value: string;
  label: string;
  icon: IconType;
  docs: string;
}[] = [
  {
    value: "slack",
    label: "Slack Agent",
    icon: withSize(SlackIcon),
    docs: "https://www.openstatus.dev/docs/guides/how-to-setup-slack-agent",
  },
  {
    value: "mcp",
    label: "MCP Server",
    icon: withSize(ModelContextProtocolIcon),
    docs: "https://www.openstatus.dev/docs/reference/mcp-server",
  },
  {
    value: "cli",
    label: "CLI",
    icon: Terminal,
    docs: "https://www.openstatus.dev/docs/reference/cli-reference",
  },
];
