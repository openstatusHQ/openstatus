import { KeyRound } from "lucide-react";
import Link from "next/link";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormCardPointer } from "@/components/forms/form-card-pointer";

import { ConnectedAppsCard } from "./connected-apps-card";

export default function Page() {
  return (
    <SectionGroup>
      <Section id="integrations">
        <SectionHeader>
          <SectionTitle>Integrations</SectionTitle>
          <SectionDescription>
            Connect third-party services to your workspace.
          </SectionDescription>
        </SectionHeader>
        <NoteDismissible cookieKey="note_integrations_api_keys">
          <KeyRound />
          Looking for your API keys? They live under Developers.
          <NoteButton variant="default" asChild>
            <Link href="/developers/api-keys">Go to API keys</Link>
          </NoteButton>
        </NoteDismissible>
        <FormCardGroup>
          <FormCardPointer
            id="slack"
            title="Slack"
            description="The Slack agent is connected, reconnected and removed under Agents."
            href="/agents/slack#slack"
            action="Go to Slack agent"
          />
          <ConnectedAppsCard />
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
