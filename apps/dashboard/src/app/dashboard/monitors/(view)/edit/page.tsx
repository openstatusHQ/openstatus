import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormMonitorUpdate } from "@/components/forms/monitor/update";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>OpenStatus API</SectionTitle>
          <SectionDescription>Customize your monitor.</SectionDescription>
        </SectionHeader>
        <FormMonitorUpdate />
      </Section>
    </SectionGroup>
  );
}
