import { useGetReel, useGetReelNotes } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function ReelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reelId = Number(id);
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: reel, isLoading } = useGetReel(reelId);
  const { data: notes } = useGetReelNotes(reelId);

  const mediaUrl = (reel as any)?.mediaUrl as string | undefined | null;
  const hasVideo = !!mediaUrl;

  const player = useVideoPlayer(
    hasVideo ? { uri: mediaUrl! } : null,
    (p) => {
      p.loop = true;
    }
  );

  function handlePlay() {
    if (!hasVideo) return;
    setIsPlaying(true);
    player.play();
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const status = (reel as any)?.status as string | undefined;
  const statusColor =
    status === "overperforming"
      ? colors.overperforming
      : status === "underperforming"
      ? colors.underperforming
      : colors.normal;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!reel) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Reel not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          { paddingTop: topPad + 4, backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        {status && (
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 40,
        }}
      >
        {/* Video / Thumbnail */}
        <Pressable
          style={[styles.mediaContainer, { backgroundColor: "#000" }]}
          onPress={handlePlay}
        >
          {isPlaying && hasVideo ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls
            />
          ) : (
            <>
              {reel.thumbnailUrl ? (
                <Image
                  source={{ uri: reel.thumbnailUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Feather name="film" size={48} color={colors.mutedForeground} />
                </View>
              )}
              {hasVideo && (
                <View style={styles.playOverlay}>
                  <View
                    style={[
                      styles.playBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Feather
                      name="play"
                      size={28}
                      color={colors.primaryForeground}
                      style={{ marginLeft: 3 }}
                    />
                  </View>
                </View>
              )}
            </>
          )}
        </Pressable>

        <View style={styles.body}>
          {reel.caption && (
            <Text style={[styles.caption, { color: colors.foreground }]}>
              {reel.caption}
            </Text>
          )}

          {reel.postedAt && (
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {new Date(reel.postedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          )}

          <View
            style={[
              styles.statsCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <StatRow icon="heart" label="Likes" value={reel.likeCount} colors={colors} />
            <Divider colors={colors} />
            <StatRow icon="message-circle" label="Comments" value={reel.commentsCount} colors={colors} />
            {(reel as any).reach != null && (
              <>
                <Divider colors={colors} />
                <StatRow icon="eye" label="Reach" value={(reel as any).reach} colors={colors} />
              </>
            )}
            {(reel as any).saves != null && (
              <>
                <Divider colors={colors} />
                <StatRow icon="bookmark" label="Saves" value={(reel as any).saves} colors={colors} />
              </>
            )}
            {(reel as any).shares != null && (
              <>
                <Divider colors={colors} />
                <StatRow icon="share-2" label="Shares" value={(reel as any).shares} colors={colors} />
              </>
            )}
          </View>

          {notes && (
            <View
              style={[
                styles.notesCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Notes
              </Text>
              {[
                { label: "Hook", val: (notes as any).hookText },
                { label: "Format", val: (notes as any).format },
                { label: "Idea Source", val: (notes as any).ideaSource },
                { label: "Emotional Reaction", val: (notes as any).emotionalReaction },
                { label: "Why Posted", val: (notes as any).whyPosted },
              ]
                .filter((f) => f.val)
                .map((f) => (
                  <View key={f.label} style={styles.noteRow}>
                    <Text
                      style={[styles.noteLabel, { color: colors.mutedForeground }]}
                    >
                      {f.label}
                    </Text>
                    <Text
                      style={[styles.noteVal, { color: colors.foreground }]}
                    >
                      {f.val}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value?: number | null;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statRow}>
      <Feather name={icon as any} size={14} color={colors.primary} />
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value != null ? value.toLocaleString() : "—"}
      </Text>
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.divider, { backgroundColor: colors.border }]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: { padding: 4 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  mediaContainer: {
    width: "100%",
    height: 380,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  thumbPlaceholder: {
    width: "100%",
    height: 380,
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  body: { padding: 16, gap: 12 },
  caption: { fontSize: 15, lineHeight: 22 },
  date: { fontSize: 12 },
  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statLabel: { flex: 1, fontSize: 13 },
  statValue: { fontSize: 15, fontWeight: "600" },
  divider: { height: 1, marginHorizontal: 14 },
  notesCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  noteRow: { gap: 2 },
  noteLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  noteVal: { fontSize: 14, lineHeight: 20 },
});
