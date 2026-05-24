const UserProfile = require("../models/UserProfile");

const sessionLocations = new Map();

const normalizeCoordinates = ({ latitude, longitude } = {}) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
};

const toGeoPoint = ({ latitude, longitude }) => ({
  type: "Point",
  coordinates: [longitude, latitude],
});

const getPharmacyCoordinates = (pharmacy = {}) => {
  const coordinates = pharmacy.location?.coordinates?.length
    ? pharmacy.location.coordinates
    : pharmacy.geoLocation?.coordinates;
  if (!coordinates?.length) return null;
  const [longitude, latitude] = coordinates;
  return normalizeCoordinates({ latitude, longitude });
};

const haversineDistanceKm = (from, to) => {
  const a = normalizeCoordinates(from);
  const b = normalizeCoordinates(to);
  if (!a || !b) return null;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const saveSessionLocation = async ({ telegramId, latitude, longitude, persistHome = false }) => {
  const normalized = normalizeCoordinates({ latitude, longitude });
  if (!normalized || !telegramId) return null;
  const key = String(telegramId);
  const value = {
    ...normalized,
    updatedAt: new Date(),
  };
  sessionLocations.set(key, value);

  if (persistHome) {
    await UserProfile.updateOne(
      { telegramId: key },
      {
        $set: {
          locationPermissionAccepted: true,
          homeLocation: {
            ...toGeoPoint(normalized),
            label: "Telegram shared location",
            updatedAt: new Date(),
          },
        },
        $setOnInsert: {
          telegramId: key,
          preferredLanguage: "hinglish",
        },
      },
      { upsert: true }
    );
  }

  return value;
};

const getSessionLocation = async (telegramId) => {
  if (!telegramId) return null;
  const key = String(telegramId);
  const cached = sessionLocations.get(key);
  if (cached) return cached;

  const profile = await UserProfile.findOne({ telegramId: key }).lean();
  const coordinates = profile?.homeLocation?.coordinates;
  if (!coordinates?.length) return null;
  const [longitude, latitude] = coordinates;
  return normalizeCoordinates({ latitude, longitude });
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return "Distance unavailable";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

const shareLocationKeyboard = () => ({
  keyboard: [[{ text: "📍 Share Location", request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
});

module.exports = {
  formatDistance,
  getPharmacyCoordinates,
  getSessionLocation,
  haversineDistanceKm,
  normalizeCoordinates,
  saveSessionLocation,
  shareLocationKeyboard,
  toGeoPoint,
};
