import { Link } from "@tanstack/react-router";
import { Home, Search, Heart, User, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import { useCart } from "@/hooks/useCart";
import { useSessionRole } from "@/lib/role-routing";

const staticItems = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/products", label: "Shop", Icon: Search },
  { to: "/cart", label: "Cart", Icon: ShoppingBag },
  { to: "/wishlist", label: "Wishlist", Icon: Heart },
] as const;

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cart = useCart();
  const sessionRole = useSessionRole();
  const items = [
    ...staticItems,
    {
      to: sessionRole.signedIn ? sessionRole.dashboardPath : "/auth",
      label: sessionRole.signedIn ? sessionRole.label ?? "Account" : "Account",
      Icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full border-t border-border bg-background/80 pb-safe backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5 items-center justify-items-center py-2 sm:py-3">
        {items.map(({ to, label, Icon }) => {
          const active = to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
          const count = to === "/cart" ? cart.count : 0;

          return (
            <Link
              key={label}
              to={to}
              className={cn(
                "group relative flex flex-col items-center gap-1 min-w-0 w-full px-1 py-1 sm:py-2",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "h-5 w-5 transition-transform duration-300",
                  active ? "scale-110 text-primary" : "group-active:scale-95"
                )} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground ring-2 ring-background">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span className="w-full truncate text-center text-[8px] font-bold tracking-tight sm:text-[10px]">
                {label}
              </span>
              {active && (
                <span className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
