export function statusHref(args: {
  q?: string;
  page?: number;
  letter?: string | null;
}): string {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.letter) params.set("letter", args.letter);
  if (args.page && args.page > 1) params.set("page", String(args.page));
  const search = params.toString();
  return search ? `/status?${search}` : "/status";
}
