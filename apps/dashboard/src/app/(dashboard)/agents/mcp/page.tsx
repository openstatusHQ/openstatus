import { Info } from "@openstatus/icons";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import NextLink from "next/link";

import { Code } from "@/components/common/code";
import { Link } from "@/components/common/link";
import { Note, NoteButton } from "@/components/common/note";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

const ENDPOINT = "https://api.openstatus.dev/mcp";

const clients = [
  {
    value: "claude-code",
    label: "Claude Code",
    description: (
      <>
        Add the server, then run <code>/mcp</code>, select{" "}
        <strong>openstatus</strong> and choose <strong>Authenticate</strong>.
        Your browser opens the consent screen.
      </>
    ),
    snippets: [
      {
        description: "OAuth (recommended)",
        code: `claude mcp add --transport http --scope user openstatus ${ENDPOINT}`,
      },
      {
        description: "API key (headless)",
        code: `claude mcp add --transport http --scope user openstatus ${ENDPOINT} --header "x-openstatus-key: os_..."`,
      },
    ],
  },
  {
    value: "claude",
    label: "Claude.ai / Desktop",
    description: (
      <>
        Open <strong>Settings</strong>, <strong>Connectors</strong>,{" "}
        <strong>Add custom connector</strong>, paste the URL and click{" "}
        <strong>Connect</strong>. Approve on the consent screen and enable the
        connector in the chat's tool picker.
      </>
    ),
    snippets: [
      { description: "Server URL", code: ENDPOINT },
      {
        description: "API key via mcp-remote (Claude Desktop only)",
        code: `{
  "mcpServers": {
    "openstatus": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${ENDPOINT}",
        "--header",
        "x-openstatus-key: \${API_KEY}"
      ],
      "env": {
        "API_KEY": "os_..."
      }
    }
  }
}`,
      },
    ],
  },
  {
    value: "cursor",
    label: "Cursor",
    description: (
      <>
        Add the server to <code>.cursor/mcp.json</code> (project) or{" "}
        <code>~/.cursor/mcp.json</code> (global). Cursor shows it as{" "}
        <strong>Needs login</strong>; click it to run the OAuth flow.
      </>
    ),
    snippets: [
      {
        description: "OAuth (recommended)",
        code: `{
  "mcpServers": {
    "openstatus": {
      "url": "${ENDPOINT}"
    }
  }
}`,
      },
      {
        description: "API key",
        code: `{
  "mcpServers": {
    "openstatus": {
      "url": "${ENDPOINT}",
      "headers": { "x-openstatus-key": "os_..." }
    }
  }
}`,
      },
    ],
  },
  {
    value: "opencode",
    label: "opencode",
    description: (
      <>
        Add the server to <code>opencode.json</code>, then run{" "}
        <code>opencode mcp auth openstatus</code> to complete the OAuth flow.
      </>
    ),
    snippets: [
      {
        description: "OAuth (recommended)",
        code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "openstatus": {
      "type": "remote",
      "url": "${ENDPOINT}",
      "enabled": true
    }
  }
}`,
      },
      {
        description: "API key",
        code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "openstatus": {
      "type": "remote",
      "url": "${ENDPOINT}",
      "enabled": true,
      "headers": { "x-openstatus-key": "{env:OPENSTATUS_API_KEY}" },
      "oauth": false
    }
  }
}`,
      },
    ],
  },
  {
    value: "chatgpt",
    label: "ChatGPT",
    description: (
      <>
        Open <strong>Settings</strong>, <strong>Connectors</strong>,{" "}
        <strong>Create</strong>, enter the URL as the MCP server URL with{" "}
        <strong>OAuth</strong> authentication, and complete the consent screen.
      </>
    ),
    snippets: [{ description: "Server URL", code: ENDPOINT }],
  },
];

const prompts = [
  {
    description: "Check the health of a monitor before a release.",
    prompt: "How did the checkout API perform over the last 7 days?",
  },
  {
    description: "Draft an incident. The assistant asks before notifying.",
    prompt:
      "Create a status report on the API status page: elevated error rates on payments, status investigating.",
  },
  {
    description: "Update subscribers on an ongoing incident.",
    prompt:
      "Post an update that we identified the cause and a fix is rolling out.",
  },
  {
    description: "Plan downtime ahead of time.",
    prompt:
      "Schedule a maintenance window for the database next Friday from 2 to 3 PM UTC.",
  },
];

const tools = [
  {
    group: "Status pages",
    items: ["list_status_pages", "list_page_components"],
  },
  {
    group: "Status reports",
    items: [
      "list_status_reports",
      "create_status_report",
      "add_status_report_update",
      "update_status_report",
      "resolve_status_report",
    ],
  },
  {
    group: "Maintenance",
    items: ["list_maintenances", "create_maintenance"],
  },
  {
    group: "Monitors",
    items: [
      "list_monitors",
      "get_monitor",
      "get_monitor_status",
      "get_monitor_summary",
      "list_response_logs",
      "get_response_log",
    ],
  },
  {
    group: "Workspace",
    items: [
      "list_notifications",
      "list_private_locations",
      "list_audit_logs",
      "get_audit_log",
    ],
  },
];

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>MCP Server</SectionTitle>
          <SectionDescription>
            Connect Claude, ChatGPT, Cursor or any Model Context Protocol client
            to read and manage your status pages, reports and maintenances from
            a conversation.{" "}
            <Link href="https://www.openstatus.dev/docs/reference/mcp-server">
              Read more
            </Link>
            .
          </SectionDescription>
        </SectionHeader>
        <Code>{ENDPOINT}</Code>
        <Tabs defaultValue={clients[0].value} className="flex flex-col gap-3">
          <TabsList>
            {clients.map((client) => (
              <TabsTrigger key={client.value} value={client.value}>
                {client.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {clients.map((client) => (
            <TabsContent
              key={client.value}
              value={client.value}
              className="flex flex-col gap-3"
            >
              <p className="text-muted-foreground text-sm">
                {client.description}
              </p>
              {client.snippets.map((snippet) => (
                <div
                  key={snippet.description}
                  className="flex flex-col gap-0.5"
                >
                  <p className="text-muted-foreground text-xs">
                    {snippet.description}
                  </p>
                  <Code>{snippet.code}</Code>
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Authentication</SectionTitle>
          <SectionDescription>
            OAuth is the default for interactive clients. Point the client at
            the endpoint with no header, sign in, pick the workspace and access
            level, and approve. Nothing to copy.
          </SectionDescription>
        </SectionHeader>
        <Note size="sm">
          <Info />
          <p>
            Every client you authorize via OAuth shows up under{" "}
            <strong>Settings &gt; Integrations</strong> as a connected app.
            Check which apps have access and revoke them at any time.
          </p>
          <NoteButton variant="default" asChild>
            <NextLink href="/settings/integrations#connected-apps">
              View connected apps
            </NextLink>
          </NoteButton>
        </Note>
        <p className="text-muted-foreground text-sm">
          For CI, cron jobs or agents running on a server, send an API key in
          the <code>x-openstatus-key</code> header instead. Create one in the{" "}
          <Link href="/settings/general">general settings</Link>. The key's
          read-only or read &amp; write scope decides which tools the server
          exposes.
        </p>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Prompts</SectionTitle>
          <SectionDescription>
            Here are some examples of what you can ask once the server is
            connected.
          </SectionDescription>
        </SectionHeader>
        <Note size="sm">
          <Info />
          Publishing tools always ask whether to notify subscribers before they
          run. Nothing is sent without an explicit yes.
        </Note>
        <ul className="flex flex-col gap-2">
          {prompts.map((item) => (
            <li key={item.prompt} className="flex flex-col gap-0.5">
              <p className="text-muted-foreground text-xs">
                {item.description}
              </p>
              <Code>{item.prompt}</Code>
            </li>
          ))}
        </ul>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Tools</SectionTitle>
          <SectionDescription>
            Read tools are available on every credential. Mutation tools require
            read &amp; write access. Audit log tools require the audit-log
            feature on your plan.
          </SectionDescription>
        </SectionHeader>
        <ul className="flex flex-col gap-2">
          {tools.map((tool) => (
            <li key={tool.group} className="flex flex-col gap-0.5">
              <p className="text-muted-foreground text-xs">{tool.group}</p>
              <Code>{tool.items.join("\n")}</Code>
            </li>
          ))}
        </ul>
      </Section>
    </SectionGroup>
  );
}
