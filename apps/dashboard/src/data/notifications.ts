export const notifications = [
  {
    id: 1,
    name: "Email",
    provider: "email",
    value: "max@openstatus.dev",
  },
];

export type Notification = (typeof notifications)[number];
