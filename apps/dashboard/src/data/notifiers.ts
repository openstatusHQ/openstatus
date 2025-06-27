export const notifiers = [
  {
    id: 1,
    name: "Email",
    provider: "email",
    value: "max@openstatus.dev",
  },
];

export type Notifier = (typeof notifiers)[number];
