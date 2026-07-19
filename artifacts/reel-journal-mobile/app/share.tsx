import { close, type InitialProps } from "expo-share-extension";
import React, { Component, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

class ShareErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: unknown) {
    return { error: String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorIcon}>✕</Text>
          <Text style={styles.title}>Extension error</Text>
          <Text style={styles.sub}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://workspaceapi-server-production-5bc6.up.railway.app";

const SHARE_API_KEY = process.env.EXPO_PUBLIC_SHARE_API_KEY ?? "";

function detectPlatform(url: string): string {
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("reddit.com") || url.includes("redd.it")) return "Reddit";
  return "link";
}

type Status = "saving" | "done" | "error" | "invalid";

function ShareExtensionInner({ url, text }: InitialProps) {
  const sharedUrl = url ?? text ?? null;
  const [status, setStatus] = useState<Status>(sharedUrl ? "saving" : "invalid");
  const [platform, setPlatform] = useState("link");
  const didSave = useRef(false);

  useEffect(() => {
    if (!sharedUrl || didSave.current) return;
    didSave.current = true;
    setPlatform(detectPlatform(sharedUrl));

    const save = async () => {
      const isSupported = sharedUrl.includes("instagram.com") || sharedUrl.includes("tiktok.com");
      if (!isSupported) {
        setStatus("invalid");
        setTimeout(close, 2500);
        return;
      }

      const resp = await fetch(`${API_URL}/api/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": SHARE_API_KEY,
        },
        body: JSON.stringify({ url: sharedUrl }),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("[Share] error", resp.status, body);
        setStatus("error");
        setTimeout(close, 2500);
        return;
      }

      setStatus("done");
      setTimeout(close, 1000);
    };

    save().catch((err) => {
      console.error("[Share] error", String(err));
      setStatus("error");
      setTimeout(close, 2500);
    });
  }, [sharedUrl]);

  return (
    <View style={styles.container}>
      {status === "saving" && (
        <>
          <ActivityIndicator color="#f07d1a" size="large" />
          <Text style={styles.title}>Saving {platform}…</Text>
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
          <Text style={styles.title}>Not supported</Text>
          <Text style={styles.sub}>Share an Instagram or TikTok link</Text>
        </>
      )}
    </View>
  );
}

export default function ShareExtension(props: InitialProps) {
  return (
    <ShareErrorBoundary>
      <ShareExtensionInner {...props} />
    </ShareErrorBoundary>
  );
}

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
    backgroundColor: "#f07d1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  checkMark: { color: "#fff", fontSize: 24, fontWeight: "700" },
  errorIcon: { fontSize: 40, color: "#ef4444", fontWeight: "700", marginBottom: 4 },
  title: { color: "#dde0eb", fontSize: 18, fontWeight: "700", textAlign: "center" },
  sub: { color: "#9098b0", fontSize: 13, textAlign: "center" },
});
