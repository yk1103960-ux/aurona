import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { ProductImage } from "@/components/product/ProductImage";
import { EmptyState } from "@/components/empty/EmptyState";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart — Aurona" }] }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const cart = useCart();

  if (loading) return null;
  if (!user) return <SignInPrompt />;
  if (cart.items.length === 0) return <EmptyCart />;

  const savings = cart.mrpTotal - cart.subtotal;
  const shipping = cart.subtotal > 999 ? 0 : 79;
  const total = cart.subtotal + shipping;

  return (
    <div className="container-x py-8">
      <h1 className="text-display text-3xl sm:text-4xl">Your cart</h1>
      <p className="mt-1 text-sm text-muted-foreground">{cart.count} items</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="divide-y divide-border rounded-xl border border-border">
          {cart.items.map((it) => (
            <div key={it.id} className="flex gap-4 p-4">
              <Link to="/products/$slug" params={{ slug: it.products.slug }} className="shrink-0">
                <ProductImage product={it.products} className="h-24 w-24" iconClassName="h-8 w-8" />
              </Link>
              <div className="flex-1">
                <Link to="/products/$slug" params={{ slug: it.products.slug }} className="text-sm font-semibold hover:text-gold">
                  {it.products.name}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground">SKU: {it.products.sku}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-base font-semibold">{inr(it.products.price)}</span>
                  {Number(it.products.mrp) > Number(it.products.price) && (
                    <span className="text-xs text-muted-foreground line-through">{inr(it.products.mrp)}</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center rounded-full border border-border">
                    <button onClick={() => cart.updateQty.mutate({ id: it.id, quantity: it.quantity - 1 })} className="grid h-9 w-9 place-items-center">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-8 text-center text-sm font-semibold">{it.quantity}</div>
                    <button onClick={() => cart.updateQty.mutate({ id: it.id, quantity: it.quantity + 1 })} className="grid h-9 w-9 place-items-center">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button onClick={() => cart.remove.mutate(it.id)} className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-6">
          <div className="text-eyebrow mb-4">Order summary</div>
          <Row label={`Subtotal (${cart.count} items)`} value={inr(cart.subtotal)} />
          {savings > 0 && <Row label="MRP savings" value={`− ${inr(savings)}`} valueClass="text-success" />}
          <Row label="Shipping" value={shipping === 0 ? "Free" : inr(shipping)} />
          <div className="my-4 h-px bg-border" />
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold">Total</div>
            <div className="text-display text-2xl">{inr(total)}</div>
          </div>
          <Button asChild size="lg" className="mt-6 h-12 w-full rounded-full">
            <Link to="/checkout">Proceed to checkout</Link>
          </Button>
          <Button asChild variant="outline" className="mt-2 w-full rounded-full">
            <Link to="/products">Continue shopping</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={"font-medium " + valueClass}>{value}</span>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="container-x py-24 text-center">
      <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" strokeWidth={1.25} />
      <h1 className="text-display mt-4 text-3xl">Your cart is empty</h1>
      <p className="mt-2 text-sm text-muted-foreground">Add some premium Aurona products to get started.</p>
      <Button asChild size="lg" className="mt-6 rounded-full">
        <Link to="/products">Explore products</Link>
      </Button>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Sign in to view your cart</h1>
      <Button asChild size="lg" className="mt-6 rounded-full">
        <Link to="/auth">Sign in</Link>
      </Button>
    </div>
  );
}
