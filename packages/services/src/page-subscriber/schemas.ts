import { z } from "zod";

const componentIdList = z.array(z.number().int().positive()).max(500);

const webhookHeaders = z
  .array(
    z.object({
      key: z.string().min(1).max(256),
      value: z.string().max(4096),
    }),
  )
  .max(20);

export const ListPageSubscribersInput = z.object({
  pageId: z.number().int().positive(),
  order: z.enum(["asc", "desc"]).optional(),
});
export type ListPageSubscribersInput = z.infer<typeof ListPageSubscribersInput>;

export const CreatePageSubscriberInput = z.discriminatedUnion("channelType", [
  z.object({
    pageId: z.number().int().positive(),
    channelType: z.literal("email"),
    email: z.email(),
    name: z.string().max(255).nullish(),
    componentIds: componentIdList.optional(),
  }),
  z.object({
    pageId: z.number().int().positive(),
    channelType: z.literal("webhook"),
    webhookUrl: z.url(),
    name: z.string().max(255).nullish(),
    headers: webhookHeaders.optional(),
    componentIds: componentIdList.optional(),
  }),
]);
export type CreatePageSubscriberInput = z.infer<
  typeof CreatePageSubscriberInput
>;

export const UpdatePageSubscriberChannelInput = z.object({
  subscriberId: z.number().int().positive(),
  pageId: z.number().int().positive(),
  name: z.string().max(255).nullish(),
  webhookUrl: z.url().optional(),
  headers: webhookHeaders.optional(),
  componentIds: componentIdList.optional(),
});
export type UpdatePageSubscriberChannelInput = z.infer<
  typeof UpdatePageSubscriberChannelInput
>;

export const SendPageSubscriberTestWebhookInput = z.object({
  subscriberId: z.number().int().positive(),
  pageId: z.number().int().positive(),
});
export type SendPageSubscriberTestWebhookInput = z.infer<
  typeof SendPageSubscriberTestWebhookInput
>;

export const DeletePageSubscriberInput = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
});
export type DeletePageSubscriberInput = z.infer<
  typeof DeletePageSubscriberInput
>;
