<Section title="Features & Specifications">
  <div className="grid gap-6 xl:grid-cols-2">
    {/* KEY FEATURES */}
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">Key Features</div>
        <div className="mt-1 text-xs text-slate-500">Add only the features required for this product.</div>
      </div>

      <div className="space-y-2">
        {f.features
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((feature, index, rows) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={feature}
                placeholder="Example: Flicker free driver"
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = e.target.value;
                  upd("features", next.join("\n"));
                }}
              />

              <Button
                type="button"
                variant="outline"
                className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  const next = rows.filter((_, i) => i !== index);
                  upd("features", next.join("\n"));
                }}
              >
                Remove
              </Button>
            </div>
          ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          const rows = f.features.split("\n").filter((line) => line.trim() !== "");

          upd("features", [...rows, "New feature"].join("\n"));
        }}
      >
        + Add Feature
      </Button>
    </div>

    {/* SPECIFICATIONS */}
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">Specifications</div>
        <div className="mt-1 text-xs text-slate-500">
          Create custom specification names and values for this product.
        </div>
      </div>

      <div className="space-y-2">
        {f.specifications
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((spec, index, rows) => {
            const separatorIndex = spec.indexOf(":");

            const label = separatorIndex >= 0 ? spec.slice(0, separatorIndex).trim() : spec.trim();

            const value = separatorIndex >= 0 ? spec.slice(separatorIndex + 1).trim() : "";

            const updateSpecification = (newLabel: string, newValue: string) => {
              const next = [...rows];
              next[index] = `${newLabel}: ${newValue}`;
              upd("specifications", next.join("\n"));
            };

            return (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  value={label}
                  placeholder="Specification"
                  onChange={(e) => updateSpecification(e.target.value, value)}
                />

                <Input value={value} placeholder="Value" onChange={(e) => updateSpecification(label, e.target.value)} />

                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    const next = rows.filter((_, i) => i !== index);
                    upd("specifications", next.join("\n"));
                  }}
                >
                  Remove
                </Button>
              </div>
            );
          })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          const rows = f.specifications.split("\n").filter((line) => line.trim() !== "");

          upd("specifications", [...rows, "New specification: Value"].join("\n"));
        }}
      >
        + Add Specification
      </Button>
    </div>
  </div>
</Section>;
