import { resolveShiprocketToken, shiprocketPickupLocations } from './src/lib/shiprocket.server';

async function test() {
  console.log("Starting Shiprocket connectivity check...");
  try {
    const token = await resolveShiprocketToken();
    console.log("✓ Successfully resolved/obtained token.");
    
    const { call, locations } = await shiprocketPickupLocations(token);
    
    if (call.ok) {
      console.log("✓ SUCCESS: Shiprocket API is REACHABLE and AUTHORIZED.");
      console.log("Pickup Locations found:", locations.length);
      console.log("Details:", JSON.stringify(locations));
    } else {
      console.log("✗ FAILED: API call returned non-OK status.");
      console.log("Status:", call.status);
      console.log("Diagnostic:", call.diagnostic.response);
    }
  } catch (error) {
    console.log("✗ ERROR during Shiprocket check:");
    console.log(error instanceof Error ? error.message : error);
  }
}

test();
