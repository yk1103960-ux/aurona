# Responsive Fixes for Orders and Cart Pages

Redesign the responsive behavior of the Orders and Cart pages to ensure a premium mobile experience without horizontal scrolling or layout breakage.

## Proposed Changes

### Orders Dashboard (`src/routes/account.tsx`)
- **Order Cards**: Use `flex-col` on mobile and `flex-row` on desktop. Ensure text wraps correctly.
- **Order Timeline**:
    - Use a flexible connector system (`flex-1`) instead of fixed widths.
    - Reduce node size and label font size on mobile.
    - Allow labels to wrap or truncate gracefully.
- **Order Actions**: Stack buttons vertically on mobile if space is tight, or use a responsive grid.
- **Global Reset**: Ensure `overflow-x-hidden` on the main container and `w-full` on all cards.

### Cart Page (`src/routes/cart.tsx`)
- **Product Rows**: On mobile, stack product details (image, title, price, quantity controls) to avoid compression.
- **Recommended Products**: Ensure the grid is `grid-cols-2` on mobile with proper gaps.
- **Sticky Bottom Bar**: Verify it spans exactly the viewport width and handles safe areas.

### Order Details (`src/routes/orders.$orderId.tsx`)
- **Main Layout**: Ensure the sidebar stacks correctly on mobile.
- **Timeline**: Standardize with the dashboard's responsive timeline.

### Global Components
- **Header**: Adjust logo and search icon spacing for narrow viewports.
- **Mobile Bottom Nav**: Ensure it fits exactly within the viewport at 320px.
- **Price Details**: Use a flexible layout for price lines to prevent overflow.

## Technical Details
- Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) and `grid`/`flex` utilities.
- Avoid `whitespace-nowrap` on long labels.
- Apply `max-w-full` and `box-sizing: border-box` to major containers.
- Test at 320px, 360px, 375px, 390px, 412px, 430px.
