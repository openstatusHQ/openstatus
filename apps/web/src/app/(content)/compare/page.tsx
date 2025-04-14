import { alternativesConfig as config } from "@/config/alternatives";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/src/components/card";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <>
      <h1 className="mb-5 font-cal text-4xl text-foreground">Compare</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {Object.entries(config).map(([slug, alternative]) => (
          <Link
            key={slug}
            href={`/compare/${slug}`}
            className="group flex w-full flex-1"
          >
            <Card className="flex w-full flex-col">
              <CardHeader className="flex-1">
                <CardTitle>{alternative.name} Alternative</CardTitle>
                <div className="flex flex-1 justify-between gap-3">
                  <CardDescription>{alternative.description}</CardDescription>
                  <ChevronRight className="h-5 w-5 shrink-0 self-end text-muted-foreground group-hover:text-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
