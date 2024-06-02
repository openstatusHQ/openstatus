"use server";

import { PlainClient } from "@team-plain/typescript-sdk";

import { env } from "@/env";

import type { FormValues } from "./contact-form";

const labelTypeIds = {
  bug: "lt_01HZDA8FCA0CMPCJ2YSTVE78XN",
  demo: "lt_01HZDA8N33R1A9AN97RGXPZ93F",
  feature: "lt_01HZDA8V56431V27GFDAVV58FX",
  question: "lt_01HZDA8XWTY0SWY4MKNY6F4EVK",
  security: "lt_01HZDA91M7KVR4529FHVHE18MG",
};

function getPriority(type: FormValues["type"], isBlocking: boolean) {
  if (type === "security") return 0;
  if (type === "bug" && isBlocking) return 1;
  return 2;
}

function isString(s: unknown): s is string {
  return typeof s === "string";
}

const client = new PlainClient({
  apiKey: env.PLAIN_API_KEY || "",
});

export async function handlePlainSupport(values: FormValues) {
  const upsertCustomerRes = await client.upsertCustomer({
    identifier: {
      emailAddress: values.email,
    },
    onCreate: {
      fullName: values.name,
      email: {
        email: values.email,
        isVerified: true,
      },
    },
    onUpdate: {},
  });

  if (upsertCustomerRes.error) {
    console.error(upsertCustomerRes.error);
    return { error: upsertCustomerRes.error.message };
  }

  console.log(`Customer upserted ${upsertCustomerRes.data.customer.id}`);

  const createThreadRes = await client.createThread({
    customerIdentifier: {
      customerId: upsertCustomerRes.data.customer.id,
    },
    title: "Support request!",
    components: [{ componentText: { text: values.message } }],
    labelTypeIds: [labelTypeIds[values.type]].filter(isString),
    priority: getPriority(values.type, values.blocker),
  });

  if (createThreadRes.error) {
    console.error(createThreadRes.error);
    return { error: createThreadRes.error.message };
  }

  console.log(`Thread created ${createThreadRes.data.id}`);

  return { error: null };
}
