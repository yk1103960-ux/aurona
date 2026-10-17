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
- Store buyer single-piece measurements in the matching prefixed variant fields; export them in a separate segment worksheet so the existing 70-column bulk-import contract stays unchanged.
- Store additional buyer/role commission configurations inside the existing variant/program row's scoped_rules; merge one scope transactionally so older commission imports and default Customer rules remain compatible.
- Keep related-selection replacement and scoped-commission resolution in tested browser-safe helpers to prevent stale selections and cross-scope fallbacks.
