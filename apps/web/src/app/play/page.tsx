import { Tracker } from "@/components/tracker";
import { getHomeMonitorListData } from "@/lib/tb";

export default async function PlayPage() {
  const data = await getHomeMonitorListData();
  return (
    <div className="relative flex flex-col items-center justify-center gap-4">
      <p className="font-cal mb-1 text-3xl">Status</p>
      <p className="text-muted-foreground text-lg font-light">
        Build your own within seconds.
      </p>
      <div className="mx-auto w-full max-w-md">
        {data && (
          <Tracker
            data={data}
            id="1"
            name="Ping"
            url="https://www.openstatus.dev/api/ping"
          />
        )}
      </div>
    </div>
  );
}
