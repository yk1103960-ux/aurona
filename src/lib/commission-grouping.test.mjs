import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMISSION_ALL_VARIANTS_LABEL,
  COMMISSION_ALL_VARIANTS_VALUE,
  normalizeCommissionGrouping,
  resolveCommissionSetOn,
} from "./commission-grouping.ts";

test("All Variants resolves to Product Manager grouping sentinel", () => {
  const resolved = resolveCommissionSetOn(
    "  ALL   VARIANTS ",
    [{ name: "Watts" }, { name: "Output Colour" }],
    [{ id: "program-1", name: "Dealer Program" }],
  );

  assert.equal(resolved.kind, "group");
  if (resolved.kind === "group") {
    assert.equal(resolved.scope, COMMISSION_ALL_VARIANTS_VALUE);
    assert.equal(resolved.label, COMMISSION_ALL_VARIANTS_LABEL);
  }
});

test("variation axis and real partner program resolve from current Product Manager sources", () => {
  const axes = [{ name: "Watts" }, { name: "Output Colour" }];
  const programs = [{ id: "program-1", name: "Dealer Program" }];

  const axis = resolveCommissionSetOn(" watts ", axes, programs);
  assert.equal(axis.kind, "group");

  const program = resolveCommissionSetOn("dealer program", axes, programs);
  assert.equal(program.kind, "program");
  if (program.kind === "program") assert.equal(program.programId, "program-1");
});

test("unknown commission grouping is not silently accepted", () => {
  assert.equal(
    resolveCommissionSetOn("Not A Real Group", [{ name: "Watts" }], []).kind,
    "unknown",
  );
});

test("commission grouping normalization removes harmless invisible spacing", () => {
  assert.equal(
    normalizeCommissionGrouping("\uFEFFAll\u00A0Variants\u200B"),
    "all variants",
  );
});
