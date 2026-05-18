import { ButtonLink } from "@/content/mdx-components/button-link";
import { CustomLink } from "@/content/mdx-components/custom-link";
import { cn } from "@/lib/utils";

type SignupCtaStripProps = {
  text: string;
  href: string;
  className?: string;
};

export function SignupCtaStrip(props: SignupCtaStripProps) {
  return (
    <div
      className={cn(
        "not-prose my-6 rounded-none border bg-muted/30 px-4 py-2 text-sm",
        props.className,
      )}
    >
      <CustomLink
        href={props.href}
        className="font-medium underline-offset-4 hover:underline"
      >
        {props.text}
      </CustomLink>
    </div>
  );
}

type SignupCtaCardProps = {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  className?: string;
};

export function SignupCtaCard(props: SignupCtaCardProps) {
  return (
    <div
      className={cn(
        "not-prose mt-10 rounded-none border bg-muted/30 p-6",
        props.className,
      )}
    >
      <p className="font-semibold text-lg">{props.title}</p>
      <p className="mt-1 text-muted-foreground text-sm">{props.description}</p>
      <div className="mt-4">
        <ButtonLink href={props.href}>{props.ctaLabel}</ButtonLink>
      </div>
    </div>
  );
}
