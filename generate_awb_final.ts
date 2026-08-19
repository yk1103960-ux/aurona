
import { shiprocketAuthed, shiprocketCall, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  console.log("--- SHIPROCKET AWB GENERATION ---");
  const orderId = "AUR26081583589";
  
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, shipment_id, awb_code")
      .eq("order_number", orderId)
      .maybeSingle();

    if (!order) {
      console.log(`Order ${orderId} not found in database. Searching Shiprocket directly...`);
    } else {
      console.log(`Order found: ${order.id}, Status: ${order.status}, Shipment ID: ${order.shipment_id}, AWB: ${order.awb_code}`);
    }

    // 2. Lookup order in Shiprocket to get its ID
    const searchRes = await shiprocketAuthed({
      stage: "lookup-order",
      path: `/orders/show/${orderId}`,
      method: "GET"
    });

    if (!searchRes.ok) {
      console.error("Failed to find order in Shiprocket:", sanitize(searchRes.raw));
      return;
    }

    const srOrder = searchRes.json?.data;
    // Shiprocket order object has a shipment_id directly or in shipments array
    const shipmentId = srOrder?.shipments?.[0]?.id || srOrder?.shipment_id;

    if (!shipmentId) {
      console.log("No shipment found in Shiprocket data:", JSON.stringify(srOrder, null, 2).slice(0, 500));
      return;
    }

    console.log(`Shipment ID found in Shiprocket: ${shipmentId}. Requesting AWB...`);

    // 3. Generate AWB
    const awbRes = await shiprocketAuthed({
      stage: "generate-awb",
      path: "/courier/assign/awb",
      method: "POST",
      body: { shipment_id: shipmentId }
    });

    if (awbRes.ok) {
      const awb = awbRes.json?.response?.data?.awb_code;
      const courier = awbRes.json?.response?.data?.courier_name;
      console.log("SUCCESS! AWB Generated:", awb, "via", courier);
      
      if (order) {
        await supabaseAdmin.from("orders").update({
          shipment_id: String(shipmentId),
          awb_code: awb,
          courier_name: courier,
          status: 'shipped'
        }).eq("id", order.id);
        console.log("Database updated.");
      }
    } else {
      console.log("AWB Generation failed:", sanitize(awbRes.raw));
    }

  } catch (error) {
    console.error("Process failed:", error);
  }
}

run();
