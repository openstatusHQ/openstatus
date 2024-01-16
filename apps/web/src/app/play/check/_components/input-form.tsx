import { Button, Input, Label } from "@openstatus/ui";

export function InputForm() {
  // TODO: add form logic
  return (
    <form className="grid gap-2">
      <Label htmlFor="url">URL</Label>
      <div className="flex w-full max-w-xl items-center space-x-2">
        <Input
          type="url"
          placeholder="https://documenso.com"
          name="url"
          id="url"
          className="w-full"
          value="https://google.com"
          disabled
        />
        <Button type="submit" disabled>
          Check
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Enter a URL to check the connection.
      </p>
    </form>
  );
}
