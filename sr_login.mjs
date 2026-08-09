import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from('shipping_providers')
  .select('credentials_ciphertext').eq('provider','shiprocket').maybeSingle();

function decrypt(stored) {
  const key = createHash("sha256").update(process.env.MFA_ENCRYPTION_KEY).digest();
  const buf = Buffer.from(stored, "base64");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

const creds = JSON.parse(decrypt(data.credentials_ciphertext));
console.log("Testing fresh login with:", creds.email);

const r = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: creds.email, password: creds.password }),
});
const text = await r.text();
console.log("Login status:", r.status);
if (r.status === 200) {
  const j = JSON.parse(text);
  console.log("✅ Fresh token acquired:", j.token?.slice(0,8) + "...");
} else {
  console.log("❌ Body:", text.slice(0, 300));
}
