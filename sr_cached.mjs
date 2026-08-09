import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from('shipping_providers')
  .select('auth_token_ciphertext, auth_token_expires_at, credentials_ciphertext')
  .eq('provider','shiprocket').maybeSingle();
if (error) { console.log("DB err:", error.message); process.exit(1); }
if (!data) { console.log("no row"); process.exit(0); }

function decrypt(stored) {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  const key = createHash("sha256").update(raw).digest();
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

const tokenJson = data.auth_token_ciphertext ? decrypt(data.auth_token_ciphertext) : null;
const token = tokenJson ? JSON.parse(tokenJson).token : null;
console.log("cached token expires:", data.auth_token_expires_at);
console.log("cached token present:", !!token);

if (token) {
  const r = await fetch("https://apiv2.shiprocket.in/v1/external/settings/company/pickup", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  console.log("Cached token test -> Status:", r.status);
  console.log("Body:", text.slice(0, 300));
}

if (data.credentials_ciphertext) {
  const creds = JSON.parse(decrypt(data.credentials_ciphertext));
  console.log("Stored email:", creds.email);
  console.log("Has password:", !!creds.password);
  console.log("Has apiToken:", !!creds.apiToken);
}
