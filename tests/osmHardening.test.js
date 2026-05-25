const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchOsmPharmacies } = require("../src/pharmacy/sources/osmPharmacySource");

test("OSM fetch retries transient failures", async () => {
  process.env.OSM_RETRIES = "1";
  let calls = 0;
  const response = await fetchOsmPharmacies({
    city: { lat: 26.9, lng: 75.7, radiusKm: 1 },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, json: async () => ({ elements: [{ id: 1, lat: 26.9, lon: 75.7, tags: { name: "Test Pharmacy" } }] }) };
    },
  });

  assert.equal(calls, 2);
  assert.equal(response.records.length, 1);
});

test("OSM fetch reports final failure after retries", async () => {
  process.env.OSM_RETRIES = "1";
  await assert.rejects(
    () =>
      fetchOsmPharmacies({
        city: { lat: 26.9, lng: 75.7, radiusKm: 1 },
        fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
      }),
    /status 500/
  );
});
