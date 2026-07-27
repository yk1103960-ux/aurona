// Modular shipping-provider architecture.
// Add new providers (Shiprocket, Delhivery, in-house) by implementing
// ShippingProvider and registering it in `providers` below.

export type ShippingAddress = {
  full_name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type ShippingRate = {
  id: string;
  provider: string;
  label: string;
  eta: string;
  price: number;
  freeAbove?: number;
};

export type RateContext = {
  subtotal: number;
  address: Partial<ShippingAddress>;
  itemCount: number;
};

export interface ShippingProvider {
  id: string;
  name: string;
  rates(ctx: RateContext): Promise<ShippingRate[]>;
}

// --- Built-in provider: Aurona in-house courier -----------------------------
const inHouse: ShippingProvider = {
  id: "aurona",
  name: "Aurona Logistics",
  async rates({ subtotal }) {
    const FREE_ABOVE = 999;
    const standard: ShippingRate = {
      id: "aurona-standard",
      provider: "aurona",
      label: "Standard delivery",
      eta: "3–7 business days",
      price: subtotal >= FREE_ABOVE ? 0 : 79,
      freeAbove: FREE_ABOVE,
    };
    const express: ShippingRate = {
      id: "aurona-express",
      provider: "aurona",
      label: "Express delivery",
      eta: "1–3 business days",
      price: 149,
    };
    return [standard, express];
  },
};

// --- Future provider stub: Shiprocket ---------------------------------------
// Kept intentionally disabled. To enable, implement `.rates()` to call the
// Shiprocket rate calculator API from a server function and push this into
// the `providers` array below.
export const shiprocketStub: ShippingProvider = {
  id: "shiprocket",
  name: "Shiprocket",
  async rates() {
    return [];
  },
};

const providers: ShippingProvider[] = [inHouse];

export async function getShippingRates(ctx: RateContext): Promise<ShippingRate[]> {
  const all = await Promise.all(providers.map((p) => p.rates(ctx)));
  return all.flat().sort((a, b) => a.price - b.price);
}

// --- Geolocation → pincode helper -------------------------------------------
// Uses browser Geolocation + a free reverse-geocode. Fails gracefully; the
// caller should surface a toast and let the user fill the form manually.
export async function detectAddressFromGeolocation(): Promise<Partial<ShippingAddress> | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  });
  if (!pos) return null;
  const { latitude, longitude } = pos.coords;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    return {
      city: a.city || a.town || a.village || a.suburb || "",
      state: a.state || "",
      pincode: a.postcode || "",
      address: [a.road, a.neighbourhood, a.suburb].filter(Boolean).join(", "),
    };
  } catch {
    return null;
  }
}
