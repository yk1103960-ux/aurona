import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function updateOrder() {
  console.log("Updating local database for order AUR26081583589...");
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('order_number', 'AUR26081583589')
    .select();

  if (error) {
    console.error("✗ FAILED to update local order:", error.message);
  } else {
    console.log("✓ SUCCESS: Local order status updated to 'cancelled'.");
    console.log("Updated row:", JSON.stringify(data));
  }
}

updateOrder();
