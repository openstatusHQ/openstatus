export function HeaderPlay({
  title,
  description,
}: Record<"title" | "description", React.ReactNode>) {
  return (
    <div className="mx-auto grid max-w-md gap-4 text-center">
      <p className="mb-1 font-cal text-3xl">{title}</p>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
