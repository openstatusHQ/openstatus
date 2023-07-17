export default function StatusPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto max-w-xl text-center">{children}</div>
      </div>
    </main>
  );
}
