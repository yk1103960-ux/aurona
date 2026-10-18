import assert from "node:assert/strict";
import test from "node:test";
import { buyerMoqPatch } from "./buyer-moq.ts";

for (const [buyer, field, value] of [["customer", "moq", 1], ["retailer", "retailer_moq", 6], ["distributor", "distributor_moq", 24]]) {
  test(`${buyer} MOQ edits only its own field`, () => {
    const before = { moq: 2, retailer_moq: 12, distributor_moq: 48 };
    const result = { ...before, ...buyerMoqPatch(buyer, String(value)) };
    assert.equal(result[field], value);
    for (const other of Object.keys(before).filter(key => key !== field)) assert.equal(result[other], before[other]);
    assert.deepEqual(Object.keys(buyerMoqPatch(buyer, String(value))), [field]);
  });
}
test("MOQ rejects zero, fractional and invalid values", () => {
  for (const value of ["0", "-1", "1.5", "invalid"]) assert.equal(buyerMoqPatch("retailer", value), null);
});