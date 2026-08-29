// Server-only abandoned-cart recovery.
// Stage 1 ("nudge") goes out once a cart has sat untouched for ~1 hour.
// Stage 2 ("coupon") goes out after 24 hours and offers the CART20 code.
// Every send is de-duplicated per (user, stage, cart signature) so a shopper
// never receives the same reminder twice for the same cart.

import { createHash } from "crypto";

const NUDGE_AFTER_MS = 60 * 60 * 1000;
const COUPON_AFTER_MS = 24 * 60 * 60 * 1000;
const COUPON_CODE = "CART20";

type CartLine = { product_id: string; quantity: number; created_at: string };

function signature(lines: CartLine[]): string {
  const flat = lines
    .map((l) => `${l.product_id}:${l.quantity}`)
    .sort()
    .join("|");
  return createHash("sha256").update(flat).digest("hex").slice(0, 32);
}

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export async function runCartReminders(limit = 100): Promise<{
  scanned: number;
  nudged: number;
  couponed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, queueMobileNotification } = await import("./notify.server");

  const { data: items } = await supabaseAdmin
    .from("cart_items")
    .select("user_id, product_id, quantity, created_at")
    .order("created_at", { ascending: true })
    .limit(2000);

  const byUser = new Map<string, CartLine[]>();
  for (const it of items ?? []) {
    if (!it.user_id || !it.product_id) continue;
    const list = byUser.get(it.user_id) ?? [];
    list.push({ product_id: it.product_id, quantity: it.quantity ?? 1, created_at: it.created_at });
    byUser.set(it.user_id, list);
  }

  let scanned = 0;
  let nudged = 0;
  let couponed = 0;

  for (const [userId, lines] of byUser) {
    if (scanned >= limit) break;
    scanned += 1;

    const newest = Math.max(...lines.map((l) => new Date(l.created_at).getTime()));
    const age = Date.now() - newest;
    if (age < NUDGE_AFTER_MS) continue;

    const stage = age >= COUPON_AFTER_MS ? "coupon" : "nudge";
    const sig = signature(lines);

    // Skip when the shopper already ordered after building this cart.
    const { data: recentOrder } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", new Date(newest).toISOString())
      .limit(1);
    if (recentOrder && recentOrder.length > 0) continue;

    const { data: already } = await supabaseAdmin
      .from("cart_reminders")
      .select("id")
      .eq("user_id", userId)
      .eq("stage", stage)
      .eq("cart_signature", sig)
      .limit(1);
    if (already && already.length > 0) continue;

    // Partner accounts are handled by our sales team, not automated coupons.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, account_type")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.account_type && profile.account_type !== "customer") continue;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email ?? null;
    if (!email) continue;

    const productIds = lines.map((l) => l.product_id);
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, price")
      .in("id", productIds);
    const priceById = new Map((products ?? []).map((p) => [p.id, p]));
    const total = lines.reduce((sum, l) => sum + (priceById.get(l.product_id)?.price ?? 0) * l.quantity, 0);
    const names = lines
      .map((l) => priceById.get(l.product_id)?.name)
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");

    const first = profile?.full_name?.split(" ")[0] ?? "there";
    const couponBlock =
      stage === "coupon"
        ? `<p style="background:#f2f7ff;border:1px solid #cfe0ff;padding:14px;border-radius:10px">
             Here's <strong>20% off</strong> to finish your order — use code
             <strong style="letter-spacing:1px">${COUPON_CODE}</strong> at checkout
             (max ₹1,500 off, orders above ₹499, one use per customer).</p>`
        : "";

    await sendEmail({
      to: email,
      userId,
      kind: stage === "coupon" ? "cart_abandoned_coupon" : "cart_abandoned",
      subject:
        stage === "coupon"
          ? "Still thinking it over? Here's 20% off your Aurona cart"
          : "You left something in your Aurona cart",
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px;font-size:20px">Hi ${first}, your cart is waiting</h2>
        <p>${names ? `You added <strong>${names}</strong>` : "You added items"}${
          total > 0 ? ` — cart value ${money(total)}` : ""
        }. Stock moves fast on popular models.</p>
        ${couponBlock}
        <p><a href="https://aurona.co.in/cart" style="color:#0b5fff">Return to my cart</a></p>
        <p style="margin-top:24px;font-size:12px;color:#777">Aurona Lighting Industries · Neem Ka Thana, Rajasthan</p>
      </div>`,
    });

    if (profile?.phone) {
      await queueMobileNotification({
        mobile: profile.phone,
        userId,
        channel: "whatsapp",
        kind: stage === "coupon" ? "cart_abandoned_coupon" : "cart_abandoned",
      });
    }

    await supabaseAdmin.from("cart_reminders").insert({
      user_id: userId,
      stage,
      cart_signature: sig,
      coupon_code: stage === "coupon" ? COUPON_CODE : null,
    } as never);

    if (stage === "coupon") couponed += 1;
    else nudged += 1;
  }

  return { scanned, nudged, couponed };
}
