import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header.Skeleton />
      <Container.Skeleton />
      <Container.Skeleton />
      <Container.Skeleton />
    </div>
  );
}
