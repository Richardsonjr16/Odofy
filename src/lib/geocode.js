const axios = require('axios');

async function geocodeAddress(addressText) {
  const apiKey = process.env.ODOFY_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('ODOFY_GOOGLE_MAPS_API_KEY is not set');
  }

  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const response = await axios.get(url, {
    params: {
      address: addressText,
      key: apiKey,
    },
  });

  const data = response.data;

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    throw new Error(
      `Geocoding failed for address: "${addressText}". Status: ${data.status}`
    );
  }

  const result = data.results[0];
  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

module.exports = { geocodeAddress };
