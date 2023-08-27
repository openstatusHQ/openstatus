export default function StatusPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <main className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto w-full max-w-xl text-center">
          {children}
          <IssueBanner />
        </div>
      </main>
      <footer className="z-10">
        <p className="text-muted-foreground text-center text-sm">
          powered by{" "}
          <a
            href="https://www.openstatus.dev"
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

function IssueBanner() {
  return (
    <p className="text-muted-foreground mt-3 text-center text-xs backdrop-blur-[2px]">
      <span className="inline-flex items-center">
        OpenStatus faced issues between 24.08. and 27.08., preventing data
        collection.
      </span>
    </p>
  );
}
