# Add segment pricing columns to Variants

## What will change
- Add Customer, Retailer, and Distributor columns to the existing Variants table.
- Show each variation's saved price for the corresponding customer segment.
- Keep all current status and action controls unchanged.
- Preserve horizontal scrolling so the wider table remains usable.

## Technical details
- Reuse the existing customer, retailer, and distributor price fields already loaded for each variant.
- No database change or migration is needed.
- Validate the updated screen through the preview when admin access permits; otherwise report the limitation clearly.
