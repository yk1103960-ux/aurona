import { createFileRoute } from "@tanstack/react-router";
import { Heart, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/empty/EmptyState";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Aurona" }] }),
  component: WishPage,
});

function WishPage() {
  const { user, loading } = useAuth();
  const wl = useWishlist();
  if (loading) return <PageLoading label="Loading your wishlist" />;
  if (!user)
    return (
      <EmptyState
        icon={LogIn}
        eyebrow="Wishlist"
        title="Your wishlist is waiting"
        description="Sign in to save your favourite products and access them anytime, on any device."
        primary={{ label: "Sign in to view wishlist", to: "/auth" }}
        secondary={{ label: "Explore products", to: "/products" }}
      />
    );
  if (wl.items.length === 0)
    return (
      <EmptyState
        icon={Heart}
        eyebrow="Wishlist"
        title="Start your wishlist"
        description="Tap the heart on any product to save it here. We'll keep it ready for you."
        primary={{ label: "Explore products", to: "/products" }}
        secondary={{ label: "Browse categories", to: "/" }}
      />
    );
  return (
    <div className="container-x py-8">
      <h1 className="text-display text-3xl sm:text-4xl">Wishlist</h1>
      <p className="mt-1 text-sm text-muted-foreground">{wl.items.length} saved</p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {wl.items.map((it) => <ProductCard key={it.id} product={it.products as any} />)}
      </div>
    </div>
  );
}

