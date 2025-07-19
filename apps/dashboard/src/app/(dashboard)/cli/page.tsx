import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { Section } from "@/components/content/section";
import { Code } from "@/components/common/code";
import { FileDown, Terminal, FileJson, Key } from "lucide-react";
import { Link } from "@/components/common/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";

const OS = ["macOs", "Windows", "Linux"] as const;

const installs = [
  {
    title: "Install CLI",
    icon: Terminal,
    description:
      "Install the OpenStatus CLI to set up your monitors straight in your code.",
    command: {
      macOs: [
        "brew install openstatusHQ/cli/openstatus --cask",
        "curl -sSL instl.sh/openstatushq/cli/macos | bash",
      ],
      Linux: ["curl -sSL instl.sh/openstatushq/cli/linux | bash"],
      Windows: ["iwr instl.sh/openstatushq/cli/windows | iex"],
    },
  },
  {
    title: "Add API Key",
    icon: Key,
    description: (
      <>
        Create an API key in your workspace{" "}
        <Link href="/settings/workspace">settings.</Link>
      </>
    ),
    command: {
      macOs: ["export OPENSTATUS_API_TOKEN=<your-api-token>"],
      Windows: ["set OPENSTATUS_API_TOKEN=<your-api-token>"],
      Linux: ["export OPENSTATUS_API_TOKEN=<your-api-token>"],
    },
  },
  {
    title: "Import Monitors",
    icon: FileDown,
    description: "Import monitors from your workspace to a YAML file.",
    command: "openstatus monitors import",
  },
  {
    title: "Manage Monitors",
    icon: FileJson,
    description:
      "Add, remove, or update monitors from a YAML file and apply your changes.",
    command: "openstatus monitors apply",
  },
] satisfies {
  title: string;
  icon: React.ElementType;
  description: React.ReactNode;
  command: string | Record<(typeof OS)[number], string[]>;
}[];

const commands = [
  {
    command: "openstatus monitors list [options]",
    description: "List all monitors in your workspace.",
  },
  {
    command: "openstatus monitors info [monitor-id] [options]",
    description: "Get information about a specific monitor.",
  },
  {
    command: "openstatus monitors trigger [monitor-id] [options]",
    description: "Trigger a monitor.",
  },
  {
    command: "openstatus run [options]",
    description: "Run a list of monitors.",
  },
];

const templates = [
  {
    description: "MCP server",
    template: `# yaml-language-server: $schema=https://www.openstatus.dev/schema.json

mcp-server:
  name: "HF MCP Server"
  description: "Hugging Face MCP server monitoring"
  frequency: "1m"
  active: true
  regions: ["iad", "ams", "lax"]
  retry: 3
  kind: http
  request:
    url: https://hf.co/mcp
    method: POST
    body: >
      {
        "jsonrpc": "2.0",
        "id": "openstatus",
        "method": "ping"
      }
    headers:
      User-Agent: OpenStatus
      Accept: application/json, text/event-stream
      Content-Type: application/json
  assertions:
    - kind: statusCode
      compare: eq
      target: 200
    - kind: textBody
      compare: eq
      target: '{"result":{},"jsonrpc":"2.0","id":"openstatus"}'
`,
  },
];

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>CLI</SectionTitle>
          <SectionDescription>
            Get started with the CLI to export and manage your monitors in your
            code.{" "}
            <Link href="https://docs.openstatus.dev/cli/getting-started/">
              Read more
            </Link>
            .
          </SectionDescription>
        </SectionHeader>
        <Tabs defaultValue={OS[0]} className="flex flex-col gap-3">
          <TabsList>
            {OS.map((os) => (
              <TabsTrigger key={os} value={os}>
                {os}
              </TabsTrigger>
            ))}
          </TabsList>
          {OS.map((os) => (
            <TabsContent key={os} value={os} className="flex flex-col gap-6">
              {installs.map((step, i) => {
                const commands =
                  typeof step.command === "string"
                    ? step.command
                    : step.command[os];
                return (
                  <div key={i} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <step.icon className="size-4" />
                        {step.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    {typeof commands === "string" ? (
                      <Code>{commands}</Code>
                    ) : (
                      <>
                        {commands.map((command, i) => (
                          <React.Fragment key={command}>
                            <Code>{command}</Code>
                            {i < commands.length - 1 && (
                              <span className="text-muted-foreground">or</span>
                            )}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Commands</SectionTitle>
          <SectionDescription>
            We have a few more commands to run. Check{" "}
            <Link
              href="https://docs.openstatus.dev/cli/getting-started/"
              target="_blank"
              rel="noopener noreferrer"
            >
              the documentation
            </Link>{" "}
            to read more.
          </SectionDescription>
        </SectionHeader>
        <ul className="flex flex-col gap-2">
          {commands.map((command, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">
                {command.description}
              </p>
              <Code>{command.command}</Code>
            </li>
          ))}
        </ul>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Templates</SectionTitle>
          <SectionDescription>
            We have a few templates to help you get started. Check{" "}
            <Link href="https://github.com/openstatusHQ/cli-template">
              the repository
            </Link>{" "}
            for more.
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-col gap-6">
          {templates.map((template, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <p className="text-sm text-muted-foreground">
                {template.description}
              </p>
              <Code>{template.template}</Code>
            </div>
          ))}
        </div>
      </Section>
    </SectionGroup>
  );
}
