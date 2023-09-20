import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";

export default function StatusPageLoading() {
  return (
    <div className="grid gap-6">
      <Header.Skeleton />
      <div className="grid gap-4">
        <Container.Skeleton />
        <Container.Skeleton />
      </div>
      <div className="grid gap-4">
        <Container.Skeleton />
      </div>
    </div>
  );
}
