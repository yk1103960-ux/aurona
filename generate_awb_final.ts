
import { shiprocketAuthed, shiprocketCall, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  console.log("--- SHIPROCKET AWB GENERATION ---");
  const orderId = "AUR26081583589";
  
  try {
    // 1. Get the order from database to get the internal ID if needed, but let's try direct lookups
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, shipment_id, awb_number")
      .eq("order_number", orderId)
      .single();

    if (!order) {
      console.error("Order not found in database.");
      return;
    }

    console.log(`Order status: ${order.status}, Shipment ID: ${order.shipment_id}, AWB: ${order.awb_number}`);

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
    const shipmentId = srOrder?.shipments?.[0]?.id || srOrder?.shipment_id;

    if (!shipmentId) {
      console.log("No shipment found for this order. Creating custom shipment...");
      // In a real flow, we'd call createAdhocOrder, but let's see if we can just trigger AWB for existing
      console.error("No shipment ID available to generate AWB.");
      return;
    }

    console.log(`Shipment ID found: ${shipmentId}. Requesting AWB...`);

    // 3. Generate AWB
    const awbRes = await shiprocketAuthed({
      stage: "generate-awb",
      path: "/courier/assign/awb",
      method: "POST",
      body: { shipment_id: shipmentId }
    });

    if (awbRes.ok) {
      const awb = awbRes.json?.response?.data?.awb_code;
      console.log("SUCCESS! AWB Generated:", awb);
      
      // Update database
      await supabaseAdmin.from("orders").update({
        shipment_id: String(shipmentId),
        awb_number: awb,
        status: 'shipped'
      }).eq("id", order.id);
      
      console.log("Database updated.");
    } else {
      console.log("AWB Generation failed:", sanitize(awbRes.raw));
    }

  } catch (error) {
    console.error("Process failed:", error);
  }
}

run();
