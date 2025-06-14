import {
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { EmptyStateContainer } from "@/components/content/empty-state";
import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormGeneral } from "@/components/forms/status-page/form-general";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Create Status Page</SectionTitle>
        </SectionHeader>
        <FormGeneral />
      </Section>
      <Section>
        <EmptyStateContainer>
          <EmptyStateTitle>Create and start customizing</EmptyStateTitle>
          <EmptyStateDescription>
            Connect your <span className="text-foreground">monitors</span>, set
            up a <span className="text-foreground">custom domain</span>,{" "}
            <span className="text-foreground">password protect</span> it and
            more...
          </EmptyStateDescription>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
