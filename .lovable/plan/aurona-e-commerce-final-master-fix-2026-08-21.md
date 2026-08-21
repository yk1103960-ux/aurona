# Aurona E-Commerce - Final Master Fix

This plan covers the completion of all pending requirements for the Aurona E-Commerce platform, focusing on the Retailer/Distributor workflow, real-time admin synchronization, Compare feature, UI refinements, and security audits.

## 🚨 OUT OF SCOPE
- **Payment Integration:** Intentionally untouched.

## 1. Retailer / Distributor Registration & Flow
- **Registration Update:**
  - Modify `src/routes/auth.tsx` to handle the multi-step flow: Register -> Details -> Mobile OTP -> Verification.
  - Integration with `public.partner_applications` table.
- **Admin Application Management:**
  - Create `src/routes/aurona-console-9f2x7k.applications.tsx` for viewing and managing applications.
  - Implement filters (Pending, Approved, Declined) and search.
  - Implement "Review Application" drawer with actions: Mark Under Review, Approve, Decline (with reason).
- **Real-time Sync:**
  - Use `useRealtime` in the admin panel to update application lists instantly.
  - Ensure user status updates in real-time on their dashboard when an application is processed.
- **Security:**
  - Server-side enforcement of `account_type` pricing eligibility via `public.current_pricing_role()` and `public.get_visible_prices()`.
  - Prevent duplicate active applications.

## 2. Authentication & Account Fixes
- **Login Audit:**
  - Debug and fix the password comparison issue where correct passwords fail.
  - Ensure `src/lib/auth.functions.ts` and Supabase Auth are correctly synchronized.
- **Email Verification:**
  - Implement a complete email verification flow with secure tokens and "Verified" status display.
- **Account Change Notifications:**
  - Trigger email confirmations for password, email, or mobile changes.

## 3. Core Features & UI
- **Compare Products:**
  - Implement "Compare" state (max 3 items) in a new context or hook.
  - Add Compare buttons to `ProductCard.tsx` and `PDP`.
  - Create `/compare` route for side-by-side spec comparison.
- **UI Refinements:**
  - Fix "First Animation" blurriness with optimized high-res logo handling.
  - Synchronize "Second Popup" width with the first.
  - Add "Additional Picture Box" on PDP per requirements.
- **CMS Verification:**
  - Audit and verify FAQ, Blogs, and Careers dynamic frontends.
  - Update Social Media links to pull from `site_settings` (no "#" placeholders).

## 4. Security & Quality Assurance
- **RLS Audit:** Verify all tables have correct policies (user-owned data restricted).
- **Responsive QA:** Test all new and existing features from 320px up to Desktop.

## Technical Details
- **Tables:** `public.partner_applications`, `public.notification_log`, `public.audit_logs`.
- **Functions:** `public.has_role`, `public.current_pricing_role`, `public.approve_partner`.
- **Hooks:** `useMyRole`, `useRealtime`, `useAuth`.

## Real-time Verification Plan
- Test application submission -> Admin notification.
- Test Admin approval -> User dashboard update (no refresh).
