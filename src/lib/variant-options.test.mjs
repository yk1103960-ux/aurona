import assert from "node:assert/strict";
import test from "node:test";
import {
  actualAxes,
  buildCombinations,
  combinationKey,
  missingCombinations,
} from "./variant-options.ts";

// Synthetic algorithm fixtures, NOT Aurona product specifications or seed data.
test("generation is dynamic and deduplicates entered values", () => {
  const axes = [
    { axis_key: "a", values: [" x ", "x", "y"] },
    { axis_key: "b", values: ["p", "q"] },
  ];
  assert.equal(buildCombinations(axes).length, 4);
});
test("bounds Cartesian expansion before allocating combinations", () => {
  assert.throws(
    () =>
      buildCombinations(
        Array.from({ length: 20 }, (_, i) => ({ axis_key: `axis${i}`, values: ["x", "y", "z"] })),
      ),
    /at most/,
  );
});
test("generation preserves existing sparse SKU records and never repurposes blank rows", () => {
  const axes = [{ axis_key: "a", values: ["x", "y"] }];
  const existing = [
    { id: "one", sku: "original", attributes: { a: "x" }, price: 123, stock: 8 },
    { id: "blank", sku: "blank-sku", attributes: {} },
  ];
  const before = structuredClone(existing);
  assert.deepEqual(missingCombinations(axes, existing), [{ a: "y" }]);
  assert.deepEqual(existing, before);
});
test("regenerating the same matrix adds nothing", () => {
  const axes = [{ axis_key: "a", values: ["x", "y"] }];
  assert.deepEqual(
    missingCombinations(
      axes,
      buildCombinations(axes).map((attributes) => ({ attributes })),
    ),
    [],
  );
});
test("ambiguous delimiters cannot collide", () => {
  const axes = [
    { axis_key: "a", values: [] },
    { axis_key: "b", values: [] },
  ];
  assert.notEqual(
    combinationKey(axes, { a: "x|b:y", b: "z" }),
    combinationKey(axes, { a: "x", b: "y|b:z" }),
  );
});
test("storefront shows only values represented by real SKUs, including legacy values", () => {
  assert.deepEqual(
    actualAxes(
      [
        { axis_key: "output", values: ["warm", "invented"] },
        { axis_key: "body", values: ["black"] },
      ],
      [{ attributes: { output: "warm" } }, { attributes: { output: "cool" } }],
    ),
    [{ axis_key: "output", values: ["warm", "cool"] }],
  );
});
test("empty or duplicate axes are rejected", () => {
  assert.throws(() => buildCombinations([]));
  assert.throws(() => buildCombinations([{ axis_key: "x", values: [] }]));
  assert.throws(() =>
    buildCombinations([
      { axis_key: "x", values: ["a"] },
      { axis_key: "x", values: ["b"] },
    ]),
  );
});

test("pasted values accept commas, new lines and tabs, and drop duplicates", () => {
  assert.deepEqual(parsePastedValues("5W, 7W\n9W\t12W;5W"), ["5W", "7W", "9W", "12W"]);
  assert.deepEqual(parsePastedValues("  \n , "), []);
});

test("generation summary counts new and existing combinations", () => {
  const axes = [
    { axis_key: "wattage", values: ["5W", "7W"] },
    { axis_key: "output_colour", values: ["Warm", "Cool"] },
  ];
  const summary = combinationSummary(axes, [{ attributes: { wattage: "5W", output_colour: "Warm" } }]);
  assert.deepEqual(summary, { total: 4, missing: 3, existing: 1 });
});
