// Config plugin: sets RCTAsyncStorage_AppGroup in the share extension's Info.plist
// so both the main app and the extension read/write from the same App Group UserDefaults.
const { withDangerousMod, withInfoPlist } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withShareExtensionAsyncStorage(config, appGroup) {
  // Main app — set via Info.plist mod
  config = withInfoPlist(config, (c) => {
    c.modResults["RCTAsyncStorage_AppGroup"] = appGroup;
    return c;
  });

  // Share extension — modify its Info.plist after expo-share-extension creates it
  config = withDangerousMod(config, [
    "ios",
    async (c) => {
      const plistPath = path.join(
        c.modRequest.platformProjectRoot,
        "ReelJournalShareExtension/Info.plist"
      );

      if (!fs.existsSync(plistPath)) {
        console.warn("[withShareExtensionAsyncStorage] Extension Info.plist not found:", plistPath);
        return c;
      }

      let content = fs.readFileSync(plistPath, "utf-8");

      if (content.includes("RCTAsyncStorage_AppGroup")) {
        return c;
      }

      content = content.replace(
        /(<\/dict>\s*<\/plist>)/,
        `\t<key>RCTAsyncStorage_AppGroup</key>\n\t<string>${appGroup}</string>\n$1`
      );

      fs.writeFileSync(plistPath, content);
      return c;
    },
  ]);

  return config;
}

module.exports = withShareExtensionAsyncStorage;
