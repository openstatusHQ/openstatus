import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Shell } from "@/components/dashboard/shell";

export default function StatusPageLoading() {
  return (
    <Shell>
      <div className="grid gap-6">
        <Header.Skeleton />
        <div className="grid gap-4">
          <Container.Skeleton />
          <Container.Skeleton />
        </div>
      </div>
    </Shell>
  );
}
