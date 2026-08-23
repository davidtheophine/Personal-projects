module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // reanimated 4 ships its worklet babel plugin via react-native-worklets;
    // it must be the last plugin.
    plugins: ['react-native-worklets/plugin'],
  }
}
