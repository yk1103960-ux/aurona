
import { resolveShiprocketToken, shiprocketCall, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function test() {
  console.log("--- SHIPROCKET E2E TEST START ---");
  
  try {
    // 1. Clear locks first to ensure we can run the test
    console.log("Clearing circuit breaker locks...");
    await supabaseAdmin.from("site_settings").upsert({ key: "shiprocket_auth_lock_until", value: "0" });
    await supabaseAdmin.from("site_settings").upsert({ key: "shiprocket_auth_active_lock", value: "false" });

    // 2. Resolve token (this might trigger a login)
    console.log("Resolving Shiprocket token...");
    const token = await resolveShiprocketToken(true);
    console.log("Token resolved successfully.");

    // 3. Test a real endpoint: Get Pickup Locations
    console.log("Testing GET /settings/company/pickup...");
    const pickupRes = await shiprocketCall({
      stage: "test-pickup",
      path: "/settings/company/pickup",
      token
    });
    
    if (pickupRes.ok) {
      console.log("SUCCESS: Pickup locations retrieved.");
      console.log("Data:", JSON.stringify(pickupRes.json, null, 2).slice(0, 500));
    } else {
      console.log(`FAILED: Pickup locations returned ${pickupRes.status}`);
      console.log("Response:", sanitize(pickupRes.raw));
    }

    // 4. Check a specific order if possible (AUR26081583589)
    console.log("Testing GET /orders/show/AUR26081583589...");
    const orderRes = await shiprocketCall({
      stage: "test-order-lookup",
      path: "/orders/show/AUR26081583589",
      token
    });

    if (orderRes.ok) {
      console.log("SUCCESS: Order found.");
      console.log("Order Data:", JSON.stringify(orderRes.json, null, 2).slice(0, 500));
    } else {
      console.log(`FAILED: Order lookup returned ${orderRes.status}`);
      console.log("Response:", sanitize(orderRes.raw));
    }

  } catch (error) {
    console.error("TEST CRASHED:", error);
  }
  
  console.log("--- SHIPROCKET E2E TEST END ---");
}

test();
