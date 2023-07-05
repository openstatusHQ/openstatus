export function Footer() {
  return (
    <footer className="text-muted-foreground mx-auto grid gap-4 text-sm">
      <p className="border-border rounded-full border px-4 py-2 text-center backdrop-blur-[2px]">
        A collaboration between{" "}
        <a
          href="https://twitter.com/mxkaske"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          @mxkaske
        </a>{" "}
        and{" "}
        <a
          href="https://twitter.com/thibaultleouay"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          @thibaultleouay
        </a>
        <span className="text-muted-foreground/70 mx-1">&bull;</span>
        See on{" "}
        <a
          href="https://github.com/mxkaske/openstatus"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
