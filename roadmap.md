# Product workflow fixes
- [ ] Repeat shared One-PC fields for all three buyer types in export without modifying saved values.
- [ ] Verify independent buyer MOQ editing/saving and add only missing controls.
- [ ] Add confirmed photo multi-delete inside Edit Product with server-enforced product/category scope; preserve existing upload and individual delete.
- [ ] Complete bulk photo deletion with Product/Variant/SKU/Active/Archived filters and photo-only deletion tests.
- [x] Reviewed existing photo selection/confirmation; added exact Variant/All Variants filter and file-cleanup warning. Verified zero-default creation through rolled-back database call.
- [x] Reviewed existing independent MOQ save/load; left working fields unchanged. Corrected related-selection replacement and saved-category reload.
- [x] Added independent buyer/customer-role commission configurations without replacing existing variant/program storage.
- [x] Added segment single-piece worksheet using actual saved fields; kept original bulk-import worksheet unchanged and filtered inactive/archived rows.
- [ ] Full admin Save → Refresh → Edit → Export verification blocked: current signed-in account has no admin access; authorized admin session required. Focused tests/build checked separately.