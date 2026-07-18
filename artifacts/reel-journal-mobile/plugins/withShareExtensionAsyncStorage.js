// Config plugin: wires up App Group storage sharing between the main app and share extension.
// Sets RCTAsyncStorage_AppGroup in both Info.plist files AND adds the App Group entitlement
// to the main app (expo-share-extension handles the extension entitlement automatically).
const { withDangerousMod, withInfoPlist, withEntitlementsPlist } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withShareExtensionAsyncStorage(config, appGroup) {
  // 1. Main app Info.plist — tell AsyncStorage which App Group suite to use
  config = withInfoPlist(config, (c) => {
    c.modResults["RCTAsyncStorage_AppGroup"] = appGroup;
    return c;
  });

  // 2. Main app entitlements — required for iOS to allow App Group storage access
  config = withEntitlementsPlist(config, (c) => {
    const existing = c.modResults["com.apple.security.application-groups"] ?? [];
    if (!existing.includes(appGroup)) {
      c.modResults["com.apple.security.application-groups"] = [...existing, appGroup];
    }
    return c;
  });

  // 3. Share extension Info.plist — same key so the extension reads from the same suite
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
