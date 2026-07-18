import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { ProductCard } from "@/components/product/ProductCard";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Aurona" }] }),
  component: WishPage,
});

function WishPage() {
  const { user, loading } = useAuth();
  const wl = useWishlist();
  if (loading) return null;
  if (!user)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-display text-3xl">Sign in to view your wishlist</h1>
        <Button asChild size="lg" className="mt-6 rounded-full"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  if (wl.items.length === 0)
    return (
      <div className="container-x py-24 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground" strokeWidth={1.25} />
        <h1 className="text-display mt-4 text-3xl">Your wishlist is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save products you love and find them here later.</p>
        <Button asChild size="lg" className="mt-6 rounded-full"><Link to="/products">Explore products</Link></Button>
      </div>
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
