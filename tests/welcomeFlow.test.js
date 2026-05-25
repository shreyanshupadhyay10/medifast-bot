const test = require("node:test");
const assert = require("node:assert/strict");
const { formatWelcome } = require("../src/utils/formatter");

test("welcome flow explains language, location, family setup, and examples", () => {
  const message = formatWelcome("Ruchin");

  assert.match(message, /Choose language/);
  assert.match(message, /Share location/);
  assert.match(message, /Add family members/);
  assert.match(message, /Dolo 650 near me/);
  assert.match(message, /side effects of Pregabalin/);
});
