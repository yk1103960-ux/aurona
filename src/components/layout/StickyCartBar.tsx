import { Link } from "@tanstack/react-router";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { inr } from "@/lib/format";

/** Mobile sticky cart bar — appears once the cart has items. */
export function StickyCartBar() {
  const cart = useCart();
  if (cart.count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 lg:hidden">
      <Link
        to="/cart"
        className="flex items-center gap-3 rounded-2xl btn-gradient px-4 py-3 shadow-lift"
      >
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-white/20">
          <ShoppingBag className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-primary">
            {cart.count}
          </span>
        </span>
        <span className="flex-1 leading-tight">
          <span className="block text-[11px] uppercase tracking-[0.16em] opacity-80">
            {cart.count} item{cart.count > 1 ? "s" : ""} in cart
          </span>
          <span className="block text-base font-bold">{inr(cart.subtotal)}</span>
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold">
          View cart <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}
