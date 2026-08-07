import { z } from "zod";

export const IntegrationProviderSchema = z.enum([
  "woocommerce",
  "shiprocket",
  "razorpay",
  "stripe",
  "phonepe",
  "sms",
]);