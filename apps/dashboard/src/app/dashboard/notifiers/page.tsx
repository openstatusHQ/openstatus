import { Link } from "@/components/common/link";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import { ActionCardGroup } from "@/components/content/action-card";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { DataTable } from "@/components/ui/data-table/data-table";
import { notifiers } from "@/data/notifiers";
import { columns } from "@/components/data-table/notifiers/columns";
import { config } from "@/data/notifiers.client";
import { FormSheetNotifier } from "@/components/forms/notifier/sheet";

const EMPTY = true;

export default function Page() {
  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Notifiers</SectionTitle>
      </SectionHeader>
      <Section>
        {EMPTY ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No notifier found</EmptyStateTitle>
          </EmptyStateContainer>
        ) : (
          <DataTable columns={columns} data={notifiers} />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Create a new notifier</SectionTitle>
          <SectionDescription>
            Define your notifiers to receive notifications when incidents.{" "}
            <Link href="#">Learn more</Link>.
          </SectionDescription>
        </SectionHeader>
        <ActionCardGroup className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Object.keys(config).map((notifier) => {
            const key = notifier as keyof typeof config;
            const Icon = config[key].icon;
            return (
              <FormSheetNotifier key={notifier} id={key}>
                <ActionCard className="h-full w-full cursor-pointer">
                  <ActionCardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-md border border-border bg-muted">
                        <Icon className="size-3" />
                      </div>
                      <ActionCardTitle>{config[key].label}</ActionCardTitle>
                    </div>
                    <ActionCardDescription>
                      Send notifications to {config[key].label}
                    </ActionCardDescription>
                  </ActionCardHeader>
                </ActionCard>
              </FormSheetNotifier>
            );
          })}
          <ActionCard className="border-dashed">
            <ActionCardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md border border-border bg-muted" />
                <ActionCardTitle className="text-muted-foreground">
                  Your Notifier
                </ActionCardTitle>
              </div>
              <ActionCardDescription>
                Missing a channel?{" "}
                <Link href="mailto:ping@openstatus.dev">Contact us</Link>
              </ActionCardDescription>
            </ActionCardHeader>
          </ActionCard>
        </ActionCardGroup>
      </Section>
    </SectionGroup>
  );
}
