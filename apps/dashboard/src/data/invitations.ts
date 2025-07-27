export const invitations = [
  {
    id: 1,
    email: "thibault@openstatus.dev",
    role: "member",
    createdAt: "2021-01-01",
    expiresAt: "2021-01-07",
    acceptedAt: "2021-01-02",
  },
];

export type Invitation = (typeof invitations)[number];
