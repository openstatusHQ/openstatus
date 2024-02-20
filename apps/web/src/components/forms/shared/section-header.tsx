export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-1">
      <h4 className="text-foreground font-medium">{title}</h4>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
