import { Link } from "@/components/common/link";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardGroup,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

const settings = [
  {
    title: "General",
    description: "Manage your workspace settings.",
    href: "/settings/general",
  },
  {
    title: "Billing",
    description: "Manage your billing information and payment methods.",
    href: "/settings/billing",
  },
  {
    title: "Account",
    description: "Manage your account information.",
    href: "/settings/account",
  },
];
export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Settings</SectionTitle>
          <SectionDescription>
            All your settings in one place.
          </SectionDescription>
        </SectionHeader>
        <ActionCardGroup>
          {settings.map((setting) => (
            <Link href={setting.href} key={setting.href}>
              <ActionCard className="h-full w-full">
                <ActionCardHeader>
                  <ActionCardTitle>{setting.title}</ActionCardTitle>
                  <ActionCardDescription>
                    {setting.description}
                  </ActionCardDescription>
                </ActionCardHeader>
              </ActionCard>
            </Link>
          ))}
        </ActionCardGroup>
      </Section>
    </SectionGroup>
  );
}
