export function HeaderPlay({
  title,
  description,
}: Record<"title" | "description", string>) {
  return (
    <div className="mx-auto grid max-w-md gap-4 text-center">
      <p className="font-cal mb-1 text-3xl">{title}</p>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
