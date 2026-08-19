
import { shiprocketLogin, shiprocketCall, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { decryptJSON } from "./src/lib/crypto.server";

async function test() {
  console.log("--- SHIPROCKET RE-AUTH TEST ---");
  
  try {
    await supabaseAdmin.from("site_settings").upsert({ key: "shiprocket_auth_lock_until", value: "0" });
    
    const { data: row } = await supabaseAdmin
      .from("shipping_providers")
      .select("credentials_ciphertext")
      .eq("provider", "shiprocket")
      .maybeSingle();

    const creds = row?.credentials_ciphertext ? decryptJSON<any>(row.credentials_ciphertext) : null;
    if (!creds?.email || !creds?.password) throw new Error("No credentials found");

    console.log(`Attempting fresh login for ${creds.email}...`);
    const loginRes = await shiprocketLogin(creds.email, creds.password);
    
    if (!loginRes.ok || !loginRes.json?.token) {
      console.log("LOGIN FAILED:", loginRes.status, sanitize(loginRes.raw));
      return;
    }

    const token = loginRes.json.token;
    console.log("Login success. Testing pickup locations with NEW token...");

    const pickupRes = await shiprocketCall({
      stage: "test-pickup-new",
      path: "/settings/company/pickup",
      token
    });
    
    console.log(`Result: ${pickupRes.status}`, sanitize(pickupRes.raw));
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
