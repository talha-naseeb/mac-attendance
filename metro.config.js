const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Isolate backend and web admin code and dependencies from Expo / React Native Metro bundler
config.resolver.blockList = [
  new RegExp(`${__dirname}/backend/.*`),
  new RegExp(`${__dirname}/web-admin/.*`),
];

module.exports = config;
