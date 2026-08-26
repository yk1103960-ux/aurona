import { isValidEmail } from "./email-validation";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TicketInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200).refine((v) => isValidEmail(v), "Enter a valid email address"),
  phone: z.string().trim().max(20).optional().nullable(),
  subject: z.string().trim().min(3).max(160),
  category: z.string().trim().max(60).optional().nullable(),
  message: z.string().trim().min(5).max(2000),
});

export const submitSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TicketInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ ...data, status: "open", priority: "normal" })
      .select("ticket_number")
      .single();
    if (error) throw new Error(error.message);
    return { ticket_number: row.ticket_number as string };
  });
