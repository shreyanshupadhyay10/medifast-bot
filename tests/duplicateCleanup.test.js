const test = require("node:test");
const assert = require("node:assert/strict");
const {
  duplicateIdentityKey,
  mergeDuplicateRecords,
} = require("../src/medicine/maintenance/duplicateCleanup");

test("duplicate identity uses medicine name, generic, aliases, and salts", () => {
  const left = duplicateIdentityKey({
    medicineName: "Dolo 650",
    genericName: "Paracetamol",
    salts: ["Paracetamol"],
    aliases: ["Dolo"],
  });
  const right = duplicateIdentityKey({
    medicineName: "Dolo-650 Tablet",
    genericName: "Paracetamol",
    salts: ["Paracetamol"],
    brands: ["Dolo"],
  });

  assert.equal(left, right);
});

test("mergeDuplicateRecords preserves canonical and merges relationship fields", () => {
  const merged = mergeDuplicateRecords([
    {
      _id: "a",
      medicineName: "Dolo 650",
      genericName: "Paracetamol",
      salts: ["Paracetamol"],
      brands: ["Dolo"],
      aliases: ["pcm"],
      sideEffects: [{ effect: "Nausea", confidence: 0.5 }],
      confidence: 0.8,
    },
    {
      _id: "b",
      medicineName: "Dolo 650 Tablet",
      genericName: "Paracetamol",
      salts: ["Paracetamol"],
      brands: ["Calpol"],
      aliases: ["fever tablet"],
      sideEffects: [{ effect: "Nausea", confidence: 0.9 }],
      confidence: 0.7,
    },
  ]);

  assert.equal(merged.canonicalId, "a");
  assert.deepEqual(merged.removeIds, ["b"]);
  assert.equal(merged.merged.brands.includes("Calpol"), true);
  assert.equal(merged.merged.aliases.includes("fever tablet"), true);
  assert.equal(merged.merged.sideEffects[0].confidence, 0.9);
});
