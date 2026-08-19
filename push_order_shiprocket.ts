
import { shiprocketCall, shiprocketLogin, sanitize } from "./src/lib/shiprocket.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { decryptJSON } from "./src/lib/crypto.server";

async function run() {
  console.log("--- SHIPROCKET PRODUCTION ORDER PUSH ---");
  const orderNumber = "AUR26081583589";
  
  try {
    // 1. Get credentials & authenticate
    const { data: row } = await supabaseAdmin
      .from("shipping_providers")
      .select("credentials_ciphertext")
      .eq("provider", "shiprocket")
      .maybeSingle();

    const creds = row?.credentials_ciphertext ? decryptJSON<any>(row.credentials_ciphertext) : null;
    if (!creds) throw new Error("No Shiprocket credentials found");
    
    console.log(`Authenticating ${creds.email}...`);
    const loginRes = await shiprocketLogin(creds.email, creds.password);
    if (!loginRes.ok) {
      console.error("Auth failed:", loginRes.status, sanitize(loginRes.raw));
      return;
    }
    const token = loginRes.json.token;

    // 2. Fetch order details from DB
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*, products(*))")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (!order || orderErr) {
      console.error("Order not found in DB:", orderNumber, orderErr);
      return;
    }

    console.log(`Order found: ${order.id}. Preparing payload for Shiprocket...`);

    // 3. Prepare Shiprocket Payload
    const payload = {
      order_id: order.order_number,
      order_date: new Date(order.created_at).toISOString().split('T')[0],
      pickup_location: "Home", // As discovered in previous turn
      billing_customer_name: order.full_name.split(' ')[0] || "Customer",
      billing_last_name: order.full_name.split(' ').slice(1).join(' ') || "User",
      billing_address: order.address || "Address not provided",
      billing_city: order.city || "City",
      billing_pincode: order.pincode,
      billing_state: order.state || "State",
      billing_country: "India",
      billing_email: order.email || "customer@example.com",
      billing_phone: order.phone,
      shipping_is_billing: true,
      order_items: order.order_items.map((item: any) => ({
        name: item.products?.name || "Product",
        sku: item.products?.sku || `SKU-${item.id}`,
        units: item.quantity,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: 9405 // Default lighting HSN
      })),
      payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
      shipping_charges: order.shipping || 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: order.discount || 0,
      sub_total: order.subtotal,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5

    };

    console.log("Pushing order to Shiprocket...");
    const createRes = await shiprocketCall({
      stage: "create-order",
      path: "/orders/create/adhoc",
      method: "POST",
      body: payload,
      token
    });

    if (!createRes.ok) {
      console.error("Order creation failed:", createRes.status, sanitize(createRes.raw));
      return;
    }

    const srData = createRes.json;
    const srOrderId = srData.order_id;
    const shipmentId = srData.shipment_id;
    console.log(`SUCCESS! Shiprocket Order ID: ${srOrderId}, Shipment ID: ${shipmentId}`);

    // 4. Generate AWB
    console.log(`Requesting AWB for Shipment ID ${shipmentId}...`);
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
      
      // 5. Update DB
      await supabaseAdmin.from("orders").update({
        shipment_id: String(shipmentId),
        awb_code: awb,
        courier_name: courier,
        status: 'shipped',
        shipment_status: 'awb_generated',
        shipment_synced_at: new Date().toISOString()
      }).eq("id", order.id);
      console.log("Database updated successfully.");
    } else {
      console.log("AWB Generation failed (Order created but AWB pending):", awbRes.status, sanitize(awbRes.raw));
      await supabaseAdmin.from("orders").update({
        shipment_id: String(shipmentId),
        shipment_synced_at: new Date().toISOString()
      }).eq("id", order.id);
    }

  } catch (error) {
    console.error("Process failed:", error);
  }
}

run();
