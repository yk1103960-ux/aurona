            <Link
              to="/aurona-console-9f2x7k/products/$id"
              params={{ id: family.legacy_product_id ?? family.id }}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" asChild aria-label="View storefront">
            <Link to="/products/$slug" params={{ slug: family.slug }} target="_blank">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          {row.archived_at ? (
            <>
              <Button size="icon" variant="success" aria-label="Restore SKU" title="Restore SKU" onClick={() => onVariantState("restore")}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="destructive" aria-label="Delete SKU permanently" title="Delete SKU permanently" onClick={onVariantDeletePermanent}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="icon" variant="ghost" aria-label="Archive SKU" title="Archive SKU" onClick={() => onVariantState("archive")}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    );
  if (column.key.startsWith("attr:")) {
    const key = column.key.slice(5);
    const axis = family.axes.find((item) => item.axis_key === key);
    const changed = Boolean(
      (dirty.attributes as Record<string, string> | undefined)?.[key] !== undefined,
    );
    return (
      <td className={`${common} ${changed ? "bg-amber-100" : ""}`}>
        <select
          className="h-8 w-full min-w-[100px] rounded border border-slate-200 bg-white px-2"
          value={row.attributes?.[key] ?? ""}
          onChange={(event) =>
            change(source, "attributes", { ...row.attributes, [key]: event.target.value })
          }
        >
          <option value="">—</option>
          {(axis?.values ?? []).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </td>
    );
  }
  if (
    column.key === "sku" ||
    column.key === "barcode" ||
    numberKeys.has(column.key as EditableKey)
  ) {
    const key = column.key as EditableKey;
    const changed = Object.prototype.hasOwnProperty.call(dirty, key);
    const value = row[key] as string | number | null;
    return (
      <td className={`${common} ${changed ? "bg-amber-100" : ""}`}>
        <Input
          className={`h-8 min-w-[80px] px-2 text-xs ${key === "sku" || key === "barcode" ? "font-mono" : "text-right"}`}
          type={key === "sku" || key === "barcode" ? "text" : "number"}
          min={key === "sku" || key === "barcode" ? undefined : 0}
          step={key === "sku" || key === "barcode" ? undefined : "0.01"}
          value={value ?? ""}
          onChange={(event) =>
            change(
              source,
              key,
              key === "sku" || key === "barcode"
                ? event.target.value
                : event.target.value === ""
                  ? null
                  : Number(event.target.value),
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              revertCell(row.id, key);
              event.currentTarget.blur();
            }
          }}
          aria-label={`${column.label} for ${row.sku}`}
        />
      </td>
    );
  }
  return <td className={common}>{column.key === "mrp" ? money(row.mrp) : "—"}</td>;
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
    >
      {label}
    </span>
  );
}
