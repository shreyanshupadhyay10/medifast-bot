const cities = {
  Jaipur: {
    name: "Jaipur",
    state: "Rajasthan",
    country: "India",
    lat: 26.9124,
    lng: 75.7873,
    radiusKm: 25,
  },
  Delhi: {
    name: "Delhi",
    state: "Delhi",
    country: "India",
    lat: 28.6139,
    lng: 77.209,
    radiusKm: 30,
  },
  Mumbai: {
    name: "Mumbai",
    state: "Maharashtra",
    country: "India",
    lat: 19.076,
    lng: 72.8777,
    radiusKm: 35,
  },
  Kota: {
    name: "Kota",
    state: "Rajasthan",
    country: "India",
    lat: 25.2138,
    lng: 75.8648,
    radiusKm: 20,
  },
};

const getCityConfig = (cityName = "Jaipur") => {
  const match = Object.values(cities).find((city) => city.name.toLowerCase() === String(cityName).toLowerCase());
  return match || cities.Jaipur;
};

module.exports = {
  cities,
  getCityConfig,
};
