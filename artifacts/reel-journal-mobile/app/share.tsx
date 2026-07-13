import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ShareExtension, useShareExtension, closeShareExtension } from "expo-share-extension";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://workspaceapi-server-production-5bc6.up.railway.app";
const SHARE_SECRET = process.env.EXPO_PUBLIC_SHARE_SECRET ?? "";

function detectPlatform(url: string): string {
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("reddit.com") || url.includes("redd.it")) return "Reddit";
  return "link";
}

type Status = "saving" | "done" | "error" | "invalid";

function ShareContent() {
  const { shareInfo } = useShareExtension();
  const [status, setStatus] = useState<Status>("saving");
  const [platform, setPlatform] = useState("link");
  const didSave = useRef(false);

  useEffect(() => {
    if (!shareInfo || didSave.current) return;

    const url = shareInfo.type === "url" ? shareInfo.value
      : shareInfo.type === "text" ? shareInfo.value
      : null;

    if (!url) {
      setStatus("invalid");
      return;
    }

    didSave.current = true;
    setPlatform(detectPlatform(url));

    fetch(`${API_URL}/api/public/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Share-Secret": SHARE_SECRET,
      },
      body: JSON.stringify({ url }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("save failed");
        setStatus("done");
        setTimeout(() => closeShareExtension(), 1000);
      })
      .catch(() => {
        setStatus("error");
        setTimeout(() => closeShareExtension(), 2000);
      });
  }, [shareInfo]);

  return (
    <View style={styles.container}>
      {status === "saving" && (
        <>
          <ActivityIndicator color="#f07d1a" size="large" />
          <Text style={styles.title}>Saving {platform}...</Text>
          <Text style={styles.sub}>Adding to Reel Journal</Text>
        </>
      )}
      {status === "done" && (
        <>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title}>Saved!</Text>
          <Text style={styles.sub}>Open Reel Journal to view it</Text>
        </>
      )}
      {status === "error" && (
        <>
          <Text style={styles.errorIcon}>✕</Text>
          <Text style={styles.title}>Couldn't save</Text>
          <Text style={styles.sub}>Check your connection and try again</Text>
        </>
      )}
      {status === "invalid" && (
        <>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.title}>Not a URL</Text>
          <Text style={styles.sub}>Share a link from Instagram, TikTok, YouTube or Reddit</Text>
        </>
      )}
    </View>
  );
}

export default function ShareExtensionRoot() {
  return (
    <ShareExtension>
      <ShareContent />
    </ShareExtension>
  );
}

const ORANGE = "#f07d1a";
const ERROR = "#ef4444";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#13151a",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  checkMark: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  errorIcon: {
    fontSize: 40,
    color: ERROR,
    fontWeight: "700",
    marginBottom: 4,
  },
  title: {
    color: "#dde0eb",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  sub: {
    color: "#9098b0",
    fontSize: 13,
    textAlign: "center",
  },
});
