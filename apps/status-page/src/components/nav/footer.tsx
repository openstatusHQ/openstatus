import { Link } from "@/components/common/link";

export function Footer(props: React.ComponentProps<"footer">) {
  return (
    <footer {...props}>
      <div className="mx-auto max-w-2xl px-3 py-2">
        <p className="text-center text-muted-foreground">
          Powered by <Link href="#">OpenStatus</Link>
        </p>
      </div>
    </footer>
  );
}
