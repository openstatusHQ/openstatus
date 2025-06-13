import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { EmptyStateDescription } from "@/components/content/empty-state";
import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormGeneral } from "@/components/forms/monitor/form-general";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Create Monitor</SectionTitle>
        </SectionHeader>
        <FormGeneral />
      </Section>
      <Section>
        <EmptyStateContainer>
          <EmptyStateTitle>Create and start customizing</EmptyStateTitle>
          <EmptyStateDescription>
            Change the <span className="text-foreground">periodicity</span>, set
            up the <span className="text-foreground">regions</span>,{" "}
            <span className="text-foreground">timeout</span> or{" "}
            <span className="text-foreground">degraded</span> duration and
            more...
          </EmptyStateDescription>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
