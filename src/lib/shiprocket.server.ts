// Server-only Shiprocket API client: auth, token cache/refresh, sanitized diagnostics.
// Never logs or returns passwords or tokens.

export const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

export type Diagnostic = {
  stage: string;
  endpoint: string;
  method: string;
  status: number | null;
  ok: boolean;
  response: string;
};

const SECRET_KEYS = /"(token|password|api_?token|access_token|refresh_token)"\s*:\s*"[^"]*"/gi;

/** Truncated, secret-stripped copy of a provider response body. */
export function sanitize(body: string, extra: string[] = []): string {
  let out = body.replace(SECRET_KEYS, '"$1":"[redacted]"');
  for (const s of extra) if (s && s.length > 3) out = out.split(s).join("[redacted]");
  return out.slice(0, 400);
}

export type ShiprocketCall = {
  status: number | null;
  ok: boolean;
  json: any;
  raw: string;
  diagnostic: Diagnostic;
};

export async function shiprocketCall(opts: {
  stage: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  token?: string;
  body?: unknown;
  redact?: string[];
}): Promise<ShiprocketCall> {
  const method = opts.method ?? "GET";
  const endpoint = `${SHIPROCKET_BASE}${opts.path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  try {
    const res = await fetch(endpoint, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    const clean = sanitize(raw, [...(opts.redact ?? []), opts.token ?? ""]);
    // eslint-disable-next-line no-console
    console.log(`[shiprocket] ${opts.stage} ${method} ${endpoint} -> ${res.status} ${clean}`);
    return {
      status: res.status,
      ok: res.ok,
      json,
      raw,
      diagnostic: { stage: opts.stage, endpoint, method, status: res.status, ok: res.ok, response: clean },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    const timeout = /timeout|abort/i.test(message);
    const response = timeout ? "Request timed out after 20s" : `Network error: ${message}`;
    // eslint-disable-next-line no-console
    console.log(`[shiprocket] ${opts.stage} ${method} ${endpoint} -> network failure: ${response}`);
    return {
      status: null,
      ok: false,
      json: null,
      raw: "",
      diagnostic: { stage: opts.stage, endpoint, method, status: null, ok: false, response },
    };
  }
}

/** Human-readable reason straight from Shiprocket, with only a light hint appended. */
export function authFailureMessage(call: ShiprocketCall): string {
  const provider =
    (typeof call.json?.message === "string" && call.json.message.trim()) ||
    (call.json?.errors && JSON.stringify(call.json.errors).slice(0, 200)) ||
    sanitize(call.raw) ||
    "";
  const status = call.status ?? "network";
  if (!provider) return `Shiprocket authentication failed (${status}).`;
  if (/access forbidden/i.test(provider)) {
    return `Shiprocket said: "${provider}" (HTTP ${status}). Shiprocket returns this when the password for this API user is wrong/outdated, or when API access for the account is switched off or IP-restricted.`;
  }
  if (/user blocked/i.test(provider)) {
    return `Shiprocket has temporarily blocked this API user due to too many failed login attempts. Please wait 30–60 minutes before trying again. (HTTP ${status}).`;
  }
  return `Shiprocket said: "${provider}" (HTTP ${status}).`;
}

export type Creds = { email?: string; password?: string; apiToken?: string };

// Shiprocket locks API users after repeated authentication failures. Keep a
// server-side circuit breaker so concurrent quotes/tests cannot fan out into
// repeated login attempts. A manual Connect submission remains one attempt.
const LOGIN_COOLDOWN_MS = 30 * 60 * 1000;
let loginBlockedUntil = 0;
let loginInFlight: Promise<ShiprocketCall> | null = null;

/** Authenticate with API-user email + password. Token-only setups skip this. */
export async function shiprocketLogin(email: string, password: string) {
  if (Date.now() < loginBlockedUntil) {
    const minutes = Math.max(1, Math.ceil((loginBlockedUntil - Date.now()) / 60_000));
    throw new Error(`Shiprocket login paused for ${minutes} minutes after a failed attempt to prevent another account lock.`);
  }
  if (loginInFlight) return loginInFlight;

  loginInFlight = shiprocketCall({
      stage: "authenticate",
      path: "/auth/login",
      method: "POST",
      body: { email, password },
      redact: [password],
    })
    .then((call) => {
      if (!call.ok || !call.json?.token) loginBlockedUntil = Date.now() + LOGIN_COOLDOWN_MS;
      else loginBlockedUntil = 0;
      return call;
    })
    .finally(() => {
      loginInFlight = null;
    });
  return loginInFlight;
}

/** Harmless authenticated probe that also returns configured pickup locations. */
export async function shiprocketPickupLocations(token: string) {
  const call = await shiprocketCall({ stage: "verify-token", path: "/settings/company/pickup", token });
  const list: Array<{ id: number; pickup_location: string; city?: string; pin_code?: string }> =
    (call.json?.data?.shipping_address ?? []).map((a: any) => ({
      id: a.id,
      pickup_location: String(a.pickup_location ?? ""),
      city: a.city ?? undefined,
      pin_code: a.pin_code ?? undefined,
    }));
  return { call, locations: list };
}

/**
 * Returns a usable bearer token for server-side calls.
 * Order: verified admin connection → runtime fallback → fresh login.
 * `force` skips the cache, which is how expiry/401 recovery works.
 */
export async function resolveShiprocketToken(force = false): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptJSON, encryptJSON } = await import("./crypto.server");

  const { data: row } = await supabaseAdmin
    .from("shipping_providers")
    .select("credentials_ciphertext, auth_token_ciphertext, auth_token_expires_at")
    .eq("provider", "shiprocket")
    .maybeSingle();

  const stored = row?.credentials_ciphertext
    ? decryptJSON<Creds>(row.credentials_ciphertext)
    : null;

  // The verified admin connection is the canonical source. This prevents an old
  // deployment secret from silently overriding credentials rotated in Admin.
  if (stored?.apiToken) return stored.apiToken;

  if (!force && row?.auth_token_ciphertext && row.auth_token_expires_at) {
    const valid = new Date(row.auth_token_expires_at).getTime() > Date.now() + 60_000;
    if (valid) return decryptJSON<{ token: string }>(row.auth_token_ciphertext).token;
  }

  // Runtime token is a fallback for deployments configured before the Admin
  // connection screen existed. It never overrides a verified stored token.
  if (process.env["SHIPROCKET_API_TOKEN"]?.trim()) return process.env["SHIPROCKET_API_TOKEN"].trim();

  const email = stored?.email || process.env["SHIPROCKET_EMAIL"]?.trim();
  const password = stored?.password || process.env["SHIPROCKET_PASSWORD"];
  if (!email || !password) throw new Error("Shiprocket is not connected");


  const call = await shiprocketLogin(email, password);
  const token = call.json?.token as string | undefined;
  if (!call.ok || !token) {
    // Login can fail temporarily (lockout / inactive API user) while a cached
    // token is still valid — prefer it over breaking shipping outright.
    if (row?.auth_token_ciphertext && row.auth_token_expires_at) {
      const valid = new Date(row.auth_token_expires_at).getTime() > Date.now();
      if (valid) return decryptJSON<{ token: string }>(row.auth_token_ciphertext).token;
    }
    throw new Error(authFailureMessage(call));
  }


  await supabaseAdmin
    .from("shipping_providers")
    .update({
      auth_token_ciphertext: encryptJSON({ token }),
      // Shiprocket tokens live ~10 days; refresh a day early.
      auth_token_expires_at: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      last_verified_at: new Date().toISOString(),
    })
    .eq("provider", "shiprocket");

  return token;
}

/** Authenticated request. Never auto-login after a rejected API call: doing so
 * can lock the API user when several shipping requests arrive together. */
export async function shiprocketAuthed(opts: {
  stage: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}): Promise<ShiprocketCall> {
  const token = await resolveShiprocketToken();
  return shiprocketCall({ ...opts, token });
}
