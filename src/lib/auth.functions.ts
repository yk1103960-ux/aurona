Replace ONLY the existing emailExists() function in src/lib/auth.functions.ts with this:

async function emailExists(email: string): Promise<boolean> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return false;

    const res = await fetch(
      `${url}/auth/v1/admin/users?per_page=100&filter=${encodeURIComponent(email)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return false;

    const j = (await res.json()) as {
      users?: {
        email?: string;
        email_confirmed_at?: string | null;
        phone_confirmed_at?: string | null;
      }[];
    };

    const user = (j.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );

    if (!user) return false;

    // Only a verified account blocks a new registration.
    // Old abandoned pre-fix users are allowed to restart OTP registration.
    return Boolean(user.email_confirmed_at || user.phone_confirmed_at);
  } catch {
    return false;
  }
}
