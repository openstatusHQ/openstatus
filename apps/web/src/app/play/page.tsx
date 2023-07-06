import { Tracker } from "@/components/monitor/tracker";
import { getMonitorListData } from "@/lib/tb";

export default async function PlayPage() {
  const data = await getMonitorListData({ siteId: "openstatus" });
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="mb-2 text-2xl font-semibold">Status</p>
      <p className="text-lg font-light">Learn more on how to build your own.</p>
      <Tracker data={data} />
    </div>
  );
}
