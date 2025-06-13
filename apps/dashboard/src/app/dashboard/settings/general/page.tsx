import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormWorkspace } from "@/components/forms/settings/form-workspace";
import { FormSlug } from "@/components/forms/settings/form-slug";
import { FormMembers } from "@/components/forms/settings/form-members";
import { FormApiKey } from "@/components/forms/settings/form-api-key";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>General</SectionTitle>
          <SectionDescription>
            Manage your workspace settings.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <FormWorkspace />
          <FormSlug />
          <FormMembers />
          <FormApiKey />
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
