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

const gettingStarted = [
  {
    title: "Install CLI",
    icon: Terminal,
    description:
      "Install the OpenStatus CLI to set up your monitors straight in your code.",
    commands: ["brew tap openstatusHQ/cli", "brew install openstatus"],
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
    commands: ["export OPENSTATUS_API_TOKEN=<your-api-token>"],
  },
  {
    title: "Import Monitors",
    icon: FileDown,
    description: "Import your current monitors to a YAML file.",
    commands: ["openstatus monitors import"],
  },
  {
    title: "Apply Changes",
    icon: FileJson,
    description:
      "Add, remove, or update monitors from a YAML file and apply your changes.",
    commands: ["openstatus monitors apply"],
  },
] satisfies {
  title: string;
  icon: React.ElementType;
  description: React.ReactNode;
  commands: string[];
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
        <div className="flex flex-col gap-6">
          <p className="text-warning">
            Warning: the following steps are for macOS only. (Windows will
            follow)
          </p>
          {gettingStarted.map((step, i) => {
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
                {step.commands.map((command, i) => (
                  <Code key={i}>{command}</Code>
                ))}
              </div>
            );
          })}
        </div>
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
    </SectionGroup>
  );
}
