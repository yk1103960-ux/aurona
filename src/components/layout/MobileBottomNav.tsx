import { Link } from "@tanstack/react-router";
import { Home, LayoutGrid, Search, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/products", label: "Shop", Icon: LayoutGrid },
  { to: "/products", label: "Search", Icon: Search },
  { to: "/wishlist", label: "Wishlist", Icon: Heart },
  { to: "/account", label: "Account", Icon: User },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ to, label, Icon }) => {
          const active = path === to;
          return (
            <Link
              key={label}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-gold")} />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
