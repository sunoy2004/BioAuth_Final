const { withExpo } = require("@expo/webpack-config");
const webpack = require("webpack");

module.exports = async function (env, argv) {
  const config = await withExpo(env, argv);

  // Fix for crypto + buffer polyfills without breaking Expo asset loader
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer/"),
    util: require.resolve("util/"),
    url: require.resolve("url/"),
    path: require.resolve("path-browserify"),
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    })
  );

  // Ensure asset MIME resolution works
  config.module.rules.push({
    test: /\.(png|jpg|jpeg|gif|svg|mp3|mp4|wav|bin)$/i,
    type: "asset/resource",
  });

  return config;
};