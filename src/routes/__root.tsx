import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
  ClientOnly,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useRolePricingRealtime } from "@/lib/pricing";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { QuickAccessRail } from "@/components/layout/QuickAccessRail";
import { StickyCartBar } from "@/components/layout/StickyCartBar";
import { CompareTray } from "@/components/product/CompareTray";

import { PageTransition } from "@/components/motion/PageTransition";
import { OffersModal } from "@/components/marketing/OffersModal";
import { CinematicIntro } from "@/components/marketing/CinematicIntro";
import { supabase } from "@/integrations/supabase/client";
import { useReferralCapture } from "@/hooks/useReferralCapture";


function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display text-7xl font-semibold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aurona — Premium LED Lighting, Fans & Home Appliances" },
      { name: "description", content: "Aurona Lighting Industries — 17+ years, 150+ products, 1000+ PAN India retail partners. Shop premium LED lighting, fans and home appliances." },
      { property: "og:title", content: "Aurona — Innovating the Way" },
      { property: "og:description", content: "Premium LED lighting, fans and home appliances engineered for modern India." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Karla:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const isAdminConsole = location.pathname.startsWith("/aurona-console-9f2x7k");
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <div className="flex min-h-screen flex-col">
        {!isAdminConsole && <Header />}
        <main className={isAdminConsole ? "flex-1" : "flex-1 pt-16 pb-16 lg:pt-[180px] lg:pb-0"}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        {!isAdminConsole && <Footer />}
        {!isAdminConsole && <QuickAccessRail />}
        {!isAdminConsole && <StickyCartBar />}
        {!isAdminConsole && <ClientOnly fallback={null}><CompareTray /></ClientOnly>}
        {!isAdminConsole && <MobileBottomNav />}

      </div>
      {!isAdminConsole && <OffersModal />}
       <ClientOnly fallback={null}><CinematicIntro /></ClientOnly>
      <Toaster position="top-center" richColors closeButton />

    </QueryClientProvider>
  );
}

function AuthListener() {
  useRolePricingRealtime();
  const router = useRouter();
  const qc = useQueryClient();
  useReferralCapture();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") qc.removeQueries({ queryKey: ["my-role-status"] });
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

