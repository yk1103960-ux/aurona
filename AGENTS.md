<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the Product Master implementation in `src/components/admin/ProductMasterPage.tsx`; its route file stays a small wrapper to prevent editor truncation from deleting the page component.
- Retain stored buyer-prefixed measurements; export shared One-PC fields in the separate segment worksheet so the existing bulk-import contract stays unchanged.
- Store additional buyer/role commission configurations inside the existing variant/program row's scoped_rules; merge one scope transactionally so older commission imports and default Customer rules remain compatible.
- Keep related-selection replacement and scoped-commission resolution in tested browser-safe helpers to prevent stale selections and cross-scope fallbacks.
- Keep bulk photo status, filtered selection and shared-object cleanup in tested browser-safe helpers; photo deletion targets only product_images and unreferenced product photo objects, never catalog records.
- Edit Product multi-photo deletion uses an authenticated server action with validated product/category ownership and scoped photo-only queries; retain shared files as individual deletion does.
