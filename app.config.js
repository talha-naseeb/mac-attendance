const appJson = require('./app.json');

module.exports = ({ config }) => {
  const baseExpo = appJson.expo || config;
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  return {
    ...baseExpo,
    ios: {
      ...baseExpo.ios,
      config: {
        ...(baseExpo.ios?.config || {}),
        ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
      },
    },
    android: {
      ...baseExpo.android,
      config: {
        ...(baseExpo.android?.config || {}),
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};
