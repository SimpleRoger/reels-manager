import { useListReferences } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Reference = {
  id: number;
  url: string;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  accountName?: string | null;
  caption?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentsCount?: number | null;
};

function VideoModal({
  item,
  onClose,
  colors,
}: {
  item: Reference;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const selectedRef = item;
  const player = useVideoPlayer(
    selectedRef.mediaUrl ? { uri: selectedRef.mediaUrl } : null,
    (p) => {
      p.loop = true;
      p.play();
    }
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]}>
      {selectedRef.mediaUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls
        />
      ) : selectedRef.thumbnailUrl ? (
        <Image
          source={{ uri: selectedRef.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Feather name="film" size={48} color={colors.mutedForeground} />
          <Text style={[styles.noVideo, { color: colors.mutedForeground }]}>
            Video not available yet
          </Text>
        </View>
      )}

      {/* Close button */}
      <Pressable
        onPress={onClose}
        style={[styles.closeBtn, { top: insets.top + 12 }]}
      >
        <Feather name="x" size={20} color="#fff" />
      </Pressable>

      {/* Stats overlay at bottom */}
      <View style={[styles.overlay, { paddingBottom: insets.bottom + 16 }]}>
        {selectedRef.accountName && (
          <Text style={styles.overlayAccount}>@{selectedRef.accountName}</Text>
        )}
        {selectedRef.caption && (
          <Text style={styles.overlayCaption} numberOfLines={2}>
            {selectedRef.caption}
          </Text>
        )}
        <View style={styles.overlayStats}>
          {selectedRef.viewCount != null && (
            <View style={styles.overlayStat}>
              <Feather name="eye" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.overlayStatText}>
                {formatNum(selectedRef.viewCount)}
              </Text>
            </View>
          )}
          {selectedRef.likeCount != null && (
            <View style={styles.overlayStat}>
              <Feather name="heart" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.overlayStatText}>
                {formatNum(selectedRef.likeCount)}
              </Text>
            </View>
          )}
          {selectedRef.commentsCount != null && (
            <View style={styles.overlayStat}>
              <Feather name="message-circle" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.overlayStatText}>
                {formatNum(selectedRef.commentsCount)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function RemakeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRef, setSelectedRef] = useState<Reference | null>(null);

  const { data, isLoading, refetch } = useListReferences();

  const refs = [...(data?.references ?? [])].sort(
    (a, b) => ((b as any).viewCount ?? -1) - ((a as any).viewCount ?? -1)
  ) as Reference[];

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Remake List
        </Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {refs.length} saved
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : refs.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bookmark" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No references saved
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Add reels from the web app
          </Text>
        </View>
      ) : (
        <FlatList
          data={refs}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80,
            paddingTop: 4,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => setSelectedRef(item)}
            >
              <View style={styles.thumbContainer}>
                {item.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.thumb,
                      {
                        backgroundColor: colors.muted,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Feather name="play" size={24} color={colors.mutedForeground} />
                  </View>
                )}
                {/* Play overlay */}
                {item.mediaUrl && (
                  <View style={styles.playOverlay}>
                    <View style={[styles.playBtn, { backgroundColor: colors.primary }]}>
                      <Feather name="play" size={14} color={colors.primaryForeground} style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                )}
                {item.mediaUrl == null && item.thumbnailUrl == null && (
                  <View style={styles.spinnerOverlay}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </View>
              <View style={styles.cardInfo}>
                {item.accountName && (
                  <Text
                    style={[styles.account, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    @{item.accountName}
                  </Text>
                )}
                <View style={styles.statsRow}>
                  {item.viewCount != null && (
                    <View style={styles.stat}>
                      <Feather name="eye" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                        {formatNum(item.viewCount)}
                      </Text>
                    </View>
                  )}
                  {item.likeCount != null && (
                    <View style={styles.stat}>
                      <Feather name="heart" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                        {formatNum(item.likeCount)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Full-screen video modal */}
      <Modal
        visible={!!selectedRef}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedRef(null)}
      >
        {selectedRef && (
          <VideoModal
            item={selectedRef}
            onClose={() => setSelectedRef(null)}
            colors={colors}
          />
        )}
      </Modal>
    </View>
  );
}

function formatNum(v?: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "700" },
  count: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptyHint: { fontSize: 13 },
  row: { gap: 8, marginBottom: 8 },
  card: { flex: 1, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  thumbContainer: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 9 / 16 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  spinnerOverlay: { position: "absolute", top: 8, left: 8 },
  cardInfo: { padding: 8 },
  account: { fontSize: 11, fontWeight: "600", marginBottom: 3 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 10 },
  // Modal styles
  closeBtn: {
    position: "absolute",
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 60,
    background: "transparent",
    backgroundImage: "linear-gradient(transparent, rgba(0,0,0,0.8))",
  },
  overlayAccount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  overlayCaption: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  overlayStats: { flexDirection: "row", gap: 16 },
  overlayStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  overlayStatText: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  noVideo: { marginTop: 12, fontSize: 14 },
});
