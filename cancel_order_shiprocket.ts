import { shiprocketAuthed } from './src/lib/shiprocket.server';

async function cancelOrder(orderId: string) {
  console.log(`Attempting to cancel Shiprocket order with ID: ${orderId}...`);
  try {
    const call = await shiprocketAuthed({
      stage: "cancel-order",
      path: "/orders/cancel",
      method: "POST",
      body: { ids: [orderId] }
    });

    if (call.ok) {
      console.log("✓ SUCCESS: Shiprocket order cancelled.");
      console.log("Response:", JSON.stringify(call.json));
    } else {
      console.log("✗ FAILED: Shiprocket cancellation failed.");
      console.log("Status:", call.status);
      console.log("Response:", call.raw);
    }
  } catch (error) {
    console.log("✗ ERROR during cancellation:");
    console.log(error instanceof Error ? error.message : error);
  }
}

// Using the Shiprocket ID from the previous successful push (1527756648)
cancelOrder("1527756648");
