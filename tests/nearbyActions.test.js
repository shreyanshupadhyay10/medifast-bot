const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNearbyActionKeyboard } = require("../src/bot/commands/nearby");
const { importPharmaciesNearLocation } = require("../src/pharmacy/sources/sourceManager");

test("nearby action keyboard exposes call and directions for top pharmacy", () => {
  const keyboard = buildNearbyActionKeyboard([
    {
      phone: "99999 99999",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=26.9,75.7",
    },
  ]);

  assert.equal(keyboard.inline_keyboard[0][0].text, "📞 Call");
  assert.equal(keyboard.inline_keyboard[0][1].text, "🧭 Directions");
  assert.equal(keyboard.inline_keyboard[0][0].callback_data, "pharmacy_call:9999999999");
});

test("nearby action keyboard degrades gracefully without pharmacy actions", () => {
  const keyboard = buildNearbyActionKeyboard([]);

  assert.equal(keyboard.inline_keyboard.length, 1);
  assert.equal(keyboard.inline_keyboard[0][0].text, "🔄 Search Again");
});

test("live location pharmacy import validates coordinates before touching OSM", async () => {
  const result = await importPharmaciesNearLocation({
    latitude: "bad",
    longitude: 75,
    dryRun: true,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    },
  });

  assert.equal(result.importedPharmacyCount, 0);
  assert.equal(result.coordinateIssues, 1);
});
