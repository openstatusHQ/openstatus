export default function StatusPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <main className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto w-full max-w-xl text-center">{children}</div>
      </main>
      <footer className="z-10">
        <p className="text-muted-foreground text-center text-sm">
          powered by{" "}
          <a
            href="https://openstatus.dev"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            openstatus.dev
          </a>
        </p>
      </footer>
    </div>
  );
}
