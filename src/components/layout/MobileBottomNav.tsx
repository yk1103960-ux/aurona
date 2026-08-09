import { Link } from "@tanstack/react-router";
import { Home, Search, Heart, User, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import { useCart } from "@/hooks/useCart";

const items = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/products", label: "Shop", Icon: Search },
  { to: "/cart", label: "Cart", Icon: ShoppingBag },
  { to: "/wishlist", label: "Wishlist", Icon: Heart },
  { to: "/account", label: "Account", Icon: User },
] as const;

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cart = useCart();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ to, label, Icon }) => {
          // Nested pages keep their tab highlighted (e.g. /products/led-bulb → Shop).
          const active = to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
          const count = to === "/cart" ? cart.count : 0;

          return (
            <Link
              key={label}
              to={to}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className={cn("h-5 w-5", active && "text-gold")} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-gold-foreground">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

