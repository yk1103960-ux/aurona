
import { shiprocketLogin, shiprocketCall, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { decryptJSON, encryptJSON } from "./src/lib/crypto.server";

async function run() {
  console.log("--- SHIPROCKET AWB GENERATION (FORCED RE-AUTH) ---");
  const orderId = "AUR26081583589";
  
  try {
    // 1. Get credentials
    const { data: row } = await supabaseAdmin
      .from("shipping_providers")
      .select("credentials_ciphertext")
      .eq("provider", "shiprocket")
      .maybeSingle();

    const creds = row?.credentials_ciphertext ? decryptJSON<any>(row.credentials_ciphertext) : null;
    if (!creds?.email || !creds?.password) throw new Error("No credentials found");

    // 2. Fresh login
    console.log(`Authenticating ${creds.email}...`);
    const loginRes = await shiprocketLogin(creds.email, creds.password);
    if (!loginRes.ok || !loginRes.json?.token) {
      console.log("LOGIN FAILED:", loginRes.status, sanitize(loginRes.raw));
      return;
    }
    const token = loginRes.json.token;
    console.log("Login success.");

    // 3. Save new token to DB cache so the app can use it
    await supabaseAdmin.from("shipping_providers").update({
      auth_token_ciphertext: encryptJSON({ token }),
      auth_token_expires_at: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      last_verified_at: new Date().toISOString()
    }).eq("provider", "shiprocket");

    // 4. Lookup order
    console.log(`Looking up order ${orderId}...`);
    const searchRes = await shiprocketCall({
      stage: "lookup-order",
      path: `/orders/show/${orderId}`,
      token
    });

    if (!searchRes.ok) {
      console.error("Order lookup failed:", searchRes.status, sanitize(searchRes.raw));
      return;
    }

    const srOrder = searchRes.json?.data;
    const shipmentId = srOrder?.shipments?.[0]?.id || srOrder?.shipment_id;

    if (!shipmentId) {
      console.error("Order found but no shipment ID present. Data:", JSON.stringify(srOrder, null, 2).slice(0, 500));
      return;
    }

    // 5. Generate AWB
    console.log(`Shipment ID ${shipmentId} found. Generating AWB...`);
    const awbRes = await shiprocketCall({
      stage: "generate-awb",
      path: "/courier/assign/awb",
      method: "POST",
      body: { shipment_id: shipmentId },
      token
    });

    if (awbRes.ok) {
      const awb = awbRes.json?.response?.data?.awb_code;
      const courier = awbRes.json?.response?.data?.courier_name;
      console.log("SUCCESS! AWB:", awb, "via", courier);
      
      // 6. Update local database
      const { data: dbOrder } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("order_number", orderId)
        .maybeSingle();

      if (dbOrder) {
        await supabaseAdmin.from("orders").update({
          shipment_id: String(shipmentId),
          awb_code: awb,
          courier_name: courier,
          status: 'shipped'
        }).eq("id", dbOrder.id);
        console.log("Local database updated.");
      }
    } else {
      console.log("AWB Generation failed:", awbRes.status, sanitize(awbRes.raw));
    }

  } catch (error) {
    console.error("Run failed:", error);
  }
}

run();
