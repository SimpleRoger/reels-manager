const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withShareExtension } = require("expo-share-extension/metro");

const config = withShareExtension(getDefaultConfig(__dirname));

config.projectRoot = __dirname;

// Monorepo: Metro resolves bundles from the workspace root, so it can't find
// index.share.js in this package. Intercept the resolution and redirect it.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "./index.share" || moduleName === "index.share") {
    return {
      filePath: path.resolve(__dirname, "index.share.js"),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
