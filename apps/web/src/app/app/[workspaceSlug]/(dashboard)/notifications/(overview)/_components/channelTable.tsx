import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

export default function ChannelTable() {
  return (
    <div className="col-span-full w-full rounded-lg border border-border border-dashed bg-background p-8">
      <h2 className="font-bold font-cal text-2xl">Channels</h2>
      <h3 className="text-muted-foreground">Connect all your channels</h3>
      <div className="mt-4 space-y-2">
        <div className="flex items-center space-x-4 rounded-md border p-4">
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm leading-none">Discord</p>
            <p className="text-muted-foreground text-sm">
              Send notifications to discord.
            </p>
          </div>
          <div>
            <Button>Create</Button>
          </div>
        </div>
        <div className="flex items-center space-x-4 rounded-md border p-4">
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm leading-none">Email</p>
            <p className="text-muted-foreground text-sm">
              Send notifications to discord.
            </p>
          </div>
          <div>
            <Button>Create</Button>
          </div>
        </div>

        <div className="flex items-center space-x-4 rounded-md border p-4">
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm leading-none">PagerDuty</p>
            <p className="text-muted-foreground text-sm">
              Send notifications to PagerDuty.
            </p>
          </div>
          <div>
            <Button asChild>
              <a href="https://app.pagerduty.com/install/integration?app_id=PN76M56&redirect_url=http://localhost:3000/app/love-openstatus/notifications/new/pagerduty&version=2">
                Create
              </a>
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-4 rounded-md border p-4">
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm leading-none">Slack</p>
            <p className="text-muted-foreground text-sm">
              Send notifications to slack.
            </p>
          </div>
          <div>
            <Button>Create</Button>
          </div>
        </div>
        <div className="flex items-center space-x-4 rounded-md border p-4">
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm leading-none">SMS</p>
            <p className="text-muted-foreground text-sm">
              Send notifications to your phones.
            </p>
          </div>
          <div>
            <Button>Create</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
