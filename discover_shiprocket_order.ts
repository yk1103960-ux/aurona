
import { shiprocketCall, shiprocketLogin, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { decryptJSON } from "./src/lib/crypto.server";

async function run() {
  console.log("--- SHIPROCKET ORDER DISCOVERY ---");
  
  try {
    const { data: row } = await supabaseAdmin
      .from("shipping_providers")
      .select("credentials_ciphertext")
      .eq("provider", "shiprocket")
      .maybeSingle();

    const creds = row?.credentials_ciphertext ? decryptJSON<any>(row.credentials_ciphertext) : null;
    const loginRes = await shiprocketLogin(creds.email, creds.password);
    const token = loginRes.json.token;

    console.log("Searching for order AUR26081583589 via list API...");
    const listRes = await shiprocketCall({
      stage: "list-orders",
      path: "/orders",
      token
    });

    if (listRes.ok) {
      const orders = listRes.json?.data || [];
      const match = orders.find((o: any) => o.channel_order_id === "AUR26081583589" || o.order_id === "AUR26081583589");
      
      if (match) {
        console.log("MATCH FOUND:", JSON.stringify(match, null, 2));
        const shipmentId = match.shipments?.[0]?.id || match.shipment_id;
        
        if (shipmentId) {
          console.log(`Generating AWB for Shipment ID: ${shipmentId}...`);
          const awbRes = await shiprocketCall({
            stage: "generate-awb",
            path: "/courier/assign/awb",
            method: "POST",
            body: { shipment_id: shipmentId },
            token
          });
          console.log("AWB Result:", sanitize(awbRes.raw));
        }
      } else {
        console.log("Order not found in the latest 50 orders. Latest orders IDs:", orders.map((o: any) => o.channel_order_id).join(", "));
      }
    } else {
      console.log("Failed to list orders:", listRes.status, sanitize(listRes.raw));
    }

  } catch (error) {
    console.error("Discovery failed:", error);
  }
}

run();
