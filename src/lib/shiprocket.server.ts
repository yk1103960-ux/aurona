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
  return `Shiprocket said: "${provider}" (HTTP ${status}).`;
}

export type Creds = { email?: string; password?: string; apiToken?: string };

/** Authenticate with API-user email + password. Token-only setups skip this. */
export async function shiprocketLogin(email: string, password: string) {
  return shiprocketCall({
    stage: "authenticate",
    path: "/auth/login",
    method: "POST",
    body: { email, password },
    redact: [password],
  });
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
 * Order: stored manual API token → cached token (if unexpired) → fresh login.
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

  // Admin-supplied static API token wins and is never mixed with login.
  if (stored?.apiToken) return stored.apiToken;

  if (!force && row?.auth_token_ciphertext && row.auth_token_expires_at) {
    const valid = new Date(row.auth_token_expires_at).getTime() > Date.now() + 60_000;
    if (valid) return decryptJSON<{ token: string }>(row.auth_token_ciphertext).token;
  }

  const email = stored?.email ?? process.env["SHIPROCKET_EMAIL"];
  const password = stored?.password ?? process.env["SHIPROCKET_PASSWORD"];
  if (!email || !password) throw new Error("Shiprocket is not connected");

  const call = await shiprocketLogin(email, password);
  const token = call.json?.token as string | undefined;
  if (!call.ok || !token) throw new Error(authFailureMessage(call));

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

/** Authenticated request that transparently re-authenticates once on 401/403. */
export async function shiprocketAuthed(opts: {
  stage: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}): Promise<ShiprocketCall> {
  let token = await resolveShiprocketToken();
  let call = await shiprocketCall({ ...opts, token });
  if (call.status === 401 || call.status === 403) {
    token = await resolveShiprocketToken(true);
    call = await shiprocketCall({ ...opts, stage: `${opts.stage}-retry`, token });
  }
  return call;
}
