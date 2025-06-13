import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

import { cva, type VariantProps } from "class-variance-authority";

// py-0
const formCardVariants = cva(
	"group relative w-full overflow-hidden py-0 shadow-none gap-4",
	{
		variants: {
			variant: {
				default: "",
				destructive: "border-destructive",
			},
			defaultVariants: {
				variant: "default",
			},
		},
	},
);

// NOTE: Add a formcardprovider to share the variant prop

export function FormCard({
	children,
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof formCardVariants>) {
	return (
		<Card className={cn(formCardVariants({ variant }), className)} {...props}>
			{children}
		</Card>
	);
}

export function FormCardHeader({
	children,
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<CardHeader
			className={cn(
				"px-4 pt-4 group-has-data-[slot=card-upgrade]:pointer-events-none group-has-data-[slot=card-upgrade]:opacity-50 [.border-b]:pb-4",
				className,
			)}
			{...props}
		>
			{children}
		</CardHeader>
	);
}

export function FormCardTitle({ children }: { children: React.ReactNode }) {
	return <CardTitle>{children}</CardTitle>;
}

export function FormCardDescription({
	children,
}: {
	children: React.ReactNode;
}) {
	return <CardDescription>{children}</CardDescription>;
}

export function FormCardContent({
	children,
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<CardContent
			className={cn(
				"px-4 group-has-data-[slot=card-upgrade]:pointer-events-none group-has-data-[slot=card-upgrade]:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
		</CardContent>
	);
}

export function FormCardSeparator({
	...props
}: React.ComponentProps<typeof Separator>) {
	return <Separator {...props} />;
}

const formCardFooterVariants = cva(
	"border-t flex items-center gap-2 pb-4 px-4 [&>:last-child]:ml-auto [.border-t]:pt-4",
	{
		variants: {
			variant: {
				default: "",
				destructive: "border-destructive bg-destructive/5",
			},
			defaultVariants: {
				variant: "default",
			},
		},
	},
);

export function FormCardFooter({
	children,
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof formCardFooterVariants>) {
	return (
		<CardFooter
			className={cn(formCardFooterVariants({ variant }), className)}
			{...props}
		>
			{children}
		</CardFooter>
	);
}

export function FormCardFooterInfo({
	children,
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer-info"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		>
			{children}
		</div>
	);
}

export function FormCardGroup({
	children,
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-group"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			{children}
		</div>
	);
}

export function FormCardUpgrade({
	children,
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-upgrade"
			className={cn("hidden", className)}
			{...props}
		>
			{children}
		</div>
	);
}

export function FormCardEmpty({
	children,
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-empty"
			className={cn(
				"pointer-events-none absolute inset-0 z-10 bg-background opacity-70 blur",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
