import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Aurona" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({
    full_name: "", phone: "", email: user?.email ?? "",
    address: "", city: "", state: "", pincode: "",
    payment_method: "cod",
  });

  if (loading) return null;
  if (!user)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-display text-3xl">Sign in to checkout</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/auth">Sign in</Link></Button>
      </div>
    );

  if (done)
    return (
      <div className="container-x py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h1 className="text-display mt-4 text-4xl">Order placed</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your order number is <span className="font-semibold text-foreground">{done}</span></p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline" className="rounded-full"><Link to="/products">Continue shopping</Link></Button>
          <Button asChild className="rounded-full"><Link to="/account">View orders</Link></Button>
        </div>
      </div>
    );

  if (cart.items.length === 0)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-display text-3xl">Your cart is empty</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/products">Explore products</Link></Button>
      </div>
    );

  const shipping = cart.subtotal > 999 ? 0 : 79;
  const total = cart.subtotal + shipping;

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    try {
      const { data: order, error } = await supabase.from("orders").insert({
        user_id: user.id,
        subtotal: cart.subtotal, discount: cart.mrpTotal - cart.subtotal,
        shipping, total, payment_method: f.payment_method,
        full_name: f.full_name, phone: f.phone, email: f.email,
        address: f.address, city: f.city, state: f.state, pincode: f.pincode,
      }).select("id, order_number").single();
      if (error) throw error;
      const items = cart.items.map((i) => ({
        order_id: order.id, product_id: i.product_id,
        product_name: i.products.name, price: i.products.price, quantity: i.quantity,
      }));
      const { error: e2 } = await supabase.from("order_items").insert(items);
      if (e2) throw e2;
      await cart.clear.mutateAsync();
      setDone(order.order_number);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container-x py-8">
      <h1 className="text-display text-3xl sm:text-4xl">Checkout</h1>
      <form onSubmit={place} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border p-6">
            <div className="text-eyebrow mb-4">1. Shipping address</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Full name" v={f.full_name} on={(v) => setF({ ...f, full_name: v })} />
              <F label="Phone" v={f.phone} on={(v) => setF({ ...f, phone: v })} />
              <F label="Email" v={f.email} on={(v) => setF({ ...f, email: v })} type="email" full />
              <F label="Address" v={f.address} on={(v) => setF({ ...f, address: v })} full />
              <F label="City" v={f.city} on={(v) => setF({ ...f, city: v })} />
              <F label="State" v={f.state} on={(v) => setF({ ...f, state: v })} />
              <F label="Pincode" v={f.pincode} on={(v) => setF({ ...f, pincode: v })} />
            </div>
          </section>

          <section className="rounded-2xl border border-border p-6">
            <div className="text-eyebrow mb-4">2. Delivery</div>
            <div className="text-sm">Standard delivery · 3–7 business days · {shipping === 0 ? "Free" : inr(shipping)}</div>
          </section>

          <section className="rounded-2xl border border-border p-6">
            <div className="text-eyebrow mb-4">3. Payment</div>
            <div className="grid gap-2">
              {[
                { v: "cod", l: "Cash on Delivery" },
                { v: "upi", l: "UPI (coming soon)", d: true },
                { v: "card", l: "Card — Visa / Mastercard (coming soon)", d: true },
              ].map((opt) => (
                <label key={opt.v} className={"flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm " + (opt.d ? "opacity-50" : "cursor-pointer hover:bg-surface")}>
                  <input type="radio" name="pay" value={opt.v} disabled={opt.d} checked={f.payment_method === opt.v} onChange={() => setF({ ...f, payment_method: opt.v })} />
                  {opt.l}
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-6">
          <div className="text-eyebrow mb-4">Order summary</div>
          <div className="space-y-2 text-sm">
            <Row l={`Subtotal (${cart.count})`} v={inr(cart.subtotal)} />
            <Row l="Shipping" v={shipping === 0 ? "Free" : inr(shipping)} />
            <div className="my-2 h-px bg-border" />
            <Row l="Total" v={inr(total)} bold />
          </div>
          <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-full" disabled={placing}>
            {placing ? "Placing order…" : "Place order"}
          </Button>
        </aside>
      </form>
    </div>
  );
}

function F({ label, v, on, type = "text", full }: { label: string; v: string; on: (v: string) => void; type?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} type={type} required className="mt-1 h-11" />
    </div>
  );
}
function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={"flex justify-between " + (bold ? "text-base font-semibold" : "text-muted-foreground")}>
      <span>{l}</span><span className={bold ? "" : "text-foreground"}>{v}</span>
    </div>
  );
}
