import { Shell } from "@/components/dashboard/shell";
import { Icons, type ValidIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const containerVariant = cva(
  "flex w-full max-h-72 overflow-hidden flex-col gap-2",
  {
    variants: {
      col: {
        1: "col-span-full md:col-span-1",
        2: "col-span-full  md:col-span-2",
        3: "col-span-full md:col-span-3",
      },
      position: {
        top: "order-2",
        right: "order-2",
        bottom: "order-1 border-b",
        left: "order-1 border-b md:border-b-0 md:border-r",
      },
    },
  },
);

interface InteractiveFeatureProps
  extends React.ComponentPropsWithoutRef<"div"> {
  component: React.ReactNode;
  icon: ValidIcon;
  iconText: string;
  title: string;
  subTitle: string;
  /**
   * Allows to include one or multiple CTA action(s)
   * @example <Button>CTA</Button>
   */
  action?: React.ReactNode;
  // grid aligment
  position: "top" | "right" | "bottom" | "left";
  col: 1 | 2;
  withGradient?: boolean;
}

export function InteractiveFeature({
  icon,
  iconText,
  title,
  subTitle,
  action,
  component,
  position,
  col,
  withGradient = false,
}: InteractiveFeatureProps) {
  const Component = component;
  const isSingleCol = ["top", "bottom"].includes(position);
  return (
    <Shell
      className={cn(
        "grid px-0 py-0 md:grid-cols-3 md:p-0",
        isSingleCol && "md:grid-cols-1",
      )}
    >
      <FeatureCardContentContainer
        variant="secondary"
        className={cn(
          containerVariant({
            col: (3 - col) as 1 | 2,
            position,
          }),
        )}
      >
        <FeatureSubheader icon={icon} text={iconText} />
        <FeatureTitle strong={title} regular={subTitle} />
        {action}
      </FeatureCardContentContainer>
      <FeatureCardContentContainer
        className={cn(
          containerVariant({
            col,
            position: isSingleCol
              ? position === "top"
                ? "bottom"
                : "top"
              : position === "left"
                ? "right"
                : "left",
          }),
          "relative",
        )}
      >
        {Component}
        {withGradient ? <Gradient /> : null}
      </FeatureCardContentContainer>
    </Shell>
  );
}

function Gradient() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 h-16 w-full overflow-hidden rounded-b-xl">
      <div className="h-full w-full bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}

interface FeatureCardContentContainer
  extends React.ComponentPropsWithoutRef<"div"> {
  variant?: "default" | "secondary";
}

function FeatureCardContentContainer({
  children,
  variant = "default",
  className,
  ...props
}: FeatureCardContentContainer) {
  return (
    <div
      className={cn(
        "px-3 py-6 md:p-8",
        variant === "secondary" && "bg-accent/50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureSubheader({ icon, text }: { icon: ValidIcon; text: string }) {
  const Icon = Icons[icon];
  return (
    <h3 className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 text-foreground" />
      {text}
    </h3>
  );
}

interface FeatureTitleProps
  extends React.ComponentPropsWithoutRef<"p">,
    Record<"strong" | "regular", string> {}

function FeatureTitle({ strong, regular }: FeatureTitleProps) {
  return (
    <p className="text-muted-foreground text-xl">
      <strong className="font-medium text-foreground">{strong}</strong>{" "}
      {regular}
    </p>
  );
}
