import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  support_phone: string;
  support_email: string;
  notification_email: string;
  notification_mobile: string;
  social_facebook: string;
  social_instagram: string;
  social_linkedin?: string;
  social_youtube: string;
  social_twitter?: string;
  social_whatsapp: string;
  business_hours: string;
  address_line: string;
  [key: string]: string | undefined;
};

export const SETTINGS_DEFAULTS: SiteSettings = {
  support_phone: "+91 96025 70026",
  support_email: "support@auronalighting.com",
  notification_email: "support@auronalighting.com",
  notification_mobile: "+91 96025 70026",
  social_facebook: "https://www.facebook.com/share/1DZmjwq3oV/",
  social_instagram: "https://www.instagram.com/auronaledlights?igsi=bm8yOGFnYWRzNXhs",
  social_youtube: "https://youtube.com/@auronalightingindustries?si=s9RaRCQ6kpTc6Ija",
  social_whatsapp: "https://wa.me/919602570026",
  business_hours: "Mon-Sat 9:30 AM – 6:30 PM IST",
  address_line: "Aurona Lighting Industries, Jaipur, Rajasthan, India",
};

export const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  staleTime: 10 * 60 * 1000,
  // Never undefined: the header/footer render contact + social links from this,
  // and an undefined value produced dead `tel:` / `mailto:` hrefs on hydration.
  placeholderData: SETTINGS_DEFAULTS,
  gcTime: 30 * 60 * 1000,
  queryFn: async (): Promise<SiteSettings> => {
    const { data, error } = await supabase.from("site_settings").select("key, value");
    if (error) return SETTINGS_DEFAULTS;
    const map: Record<string, string | undefined> = { ...SETTINGS_DEFAULTS };
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      // Blank values in the settings table must not wipe out a working
      // default — an empty phone/email produced dead `tel:` / `mailto:` links.
      const value = (row.value ?? "").trim();
      if (value) map[row.key] = value;
    }
    return map as SiteSettings;
  },
});
