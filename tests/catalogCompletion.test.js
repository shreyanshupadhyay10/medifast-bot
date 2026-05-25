const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateCoverage,
  calculateProgressCompletion,
} = require("../src/medicine/diagnostics/catalogDiagnostics");

test("catalog completion distinguishes vector coverage from ingestion progress", () => {
  assert.equal(calculateCoverage({ totalMedicines: 251158, vectorizedMedicines: 2250 }), 0.9);
  assert.equal(calculateProgressCompletion({ totalMedicines: 251158, processedRecords: 750 }), 0.3);
  assert.equal(calculateProgressCompletion({ totalMedicines: 251158, processedRecords: 251158, complete: true }), 100);
});
