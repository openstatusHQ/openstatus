import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import {
  FormCardDescription,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";
import {
  FormCard,
  FormCardContent,
  FormCardFooter,
} from "@/components/forms/form-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Account</SectionTitle>
        </SectionHeader>
        <FormCard>
          <FormCardUpgrade />
          <FormCardHeader>
            <FormCardTitle>Personal Information</FormCardTitle>
            <FormCardDescription>
              Manage your personal information.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <form className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input placeholder="max@openstatus.dev" />
              </div>
            </form>
          </FormCardContent>
          <FormCardFooter className="[&>:last-child]:ml-0">
            <FormCardFooterInfo>
              Please contact us if you want to change your email or name.
            </FormCardFooterInfo>
          </FormCardFooter>
        </FormCard>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Appearance</FormCardTitle>
            <FormCardDescription>
              Choose your preferred theme.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="pb-4">
            <ThemeToggle />
          </FormCardContent>
        </FormCard>
      </Section>
    </SectionGroup>
  );
}
