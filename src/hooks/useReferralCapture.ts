import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  trackReferralVisit,
  claimReferral,
  trackProductReferralClick,
} from "@/lib/affiliate.functions";
import { useAuth } from "./useAuth";


const VISITOR_KEY = "aurona_visitor_id";
const REF_KEY = "aurona_ref_code";

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/**
 * Captures `?ref=CODE` affiliate attribution once per visit and binds any
 * anonymous attribution to the user as soon as they sign in.
 */
export function useReferralCapture() {
  const { user } = useAuth();
  const track = useServerFn(trackReferralVisit);
  const claim = useServerFn(claimReferral);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref")?.trim();
    if (!code) return;
    const vid = visitorId();
    localStorage.setItem(REF_KEY, code);
    // 1-year cookie so server-side flows can read it too.
    document.cookie = `aurona_ref=${encodeURIComponent(code)}; path=/; max-age=${365 * 86400}; samesite=lax`;
    track({
      data: {
        code,
        visitorId: vid,
        landingPath: window.location.pathname,
        referrer: document.referrer?.slice(0, 300) || undefined,
      },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    claim({ data: { visitorId: visitorId() } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

/**
 * Product-page attribution: when a visitor lands on a PDP through an
 * affiliate's product link, log the click against that product once.
 */
export function useProductReferralClick(productId: string | null) {
  const trackProduct = useServerFn(trackProductReferralClick);

  useEffect(() => {
    if (typeof window === "undefined" || !productId) return;
    const code =
      new URLSearchParams(window.location.search).get("ref")?.trim() ||
      localStorage.getItem(REF_KEY)?.trim();
    if (!code) return;
    const once = `aurona_pc_${productId}_${code}`;
    if (sessionStorage.getItem(once)) return;
    sessionStorage.setItem(once, "1");
    trackProduct({
      data: {
        code,
        visitorId: visitorId(),
        productId,
        landingPath: window.location.pathname,
        referrer: document.referrer?.slice(0, 300) || undefined,
      },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);
}
