export default async function Page({ params }: { params: { domain: string } }) {
  // We should fetch the the monitors and incident here
  // also the page information

  return (
    <main className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="border-border rounded-lg border p-8 backdrop-blur-[2px]">
            <h1 className="text-foreground font-cal mb-6 mt-2 text-3xl">
              Open-source monitoring service for {params.domain}
            </h1>
          </div>
        </div>
      </div>
    </main>
  );
}
