export const subscribers = [
  {
    id: "1",
    email: "max@openstatus.dev",
    createdAt: "2025-05-20",
    validatedAt: "2025-05-20",
  },
  {
    id: "2",
    email: "thibault@openstatus.dev",
    createdAt: "2025-05-20",
    validatedAt: "2025-05-20",
  },
];

export type Subscriber = (typeof subscribers)[number];
