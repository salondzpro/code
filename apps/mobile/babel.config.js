module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Doit rester en DERNIER (Reanimated 4 / worklets).
    plugins: ['react-native-worklets/plugin'],
  };
};
