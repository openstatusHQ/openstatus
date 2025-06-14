import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormStatusPageUpdate } from "@/components/forms/status-page/update";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>OpenStatus Status</SectionTitle>
          <SectionDescription>Customize your status page.</SectionDescription>
        </SectionHeader>
        <FormStatusPageUpdate />
      </Section>
    </SectionGroup>
  );
}
