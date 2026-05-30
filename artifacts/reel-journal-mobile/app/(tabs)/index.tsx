import { useListReels } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function PerformanceBadge({ status }: { status?: string | null }) {
  const colors = useColors();
  if (!status) return null;
  const color =
    status === "overperforming"
      ? colors.overperforming
      : status === "underperforming"
      ? colors.underperforming
      : colors.normal;
  const label =
    status === "overperforming"
      ? "Over"
      : status === "underperforming"
      ? "Under"
      : "Normal";
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function ReelsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useListReels({
    sortBy: "postedAt",
    sortOrder: "desc",
    limit: 50,
  });

  const reels = data?.reels ?? [];

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          REEL<Text style={{ color: colors.primary }}>JOURNAL</Text>
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {reels.length} reels
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.center}>
          <Feather name="film" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No reels yet
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Sync your Instagram in Settings
          </Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80,
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
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => router.push(`/reel/${item.id}`)}
            >
              <View style={styles.cardRow}>
                {item.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={[styles.thumb, { backgroundColor: colors.muted }]}
                  />
                ) : (
                  <View
                    style={[styles.thumb, { backgroundColor: colors.muted }]}
                  >
                    <Feather name="film" size={20} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text
                      style={[styles.caption, { color: colors.foreground }]}
                      numberOfLines={2}
                    >
                      {item.caption ?? "No caption"}
                    </Text>
                    <PerformanceBadge status={(item as any).status} />
                  </View>
                  <Text
                    style={[styles.date, { color: colors.mutedForeground }]}
                  >
                    {item.postedAt
                      ? new Date(item.postedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </Text>
                  <View style={styles.statsRow}>
                    <StatChip icon="heart" value={item.likeCount} colors={colors} />
                    <StatChip icon="message-circle" value={item.commentsCount} colors={colors} />
                    {(item as any).reach != null && (
                      <StatChip icon="eye" value={(item as any).reach} colors={colors} />
                    )}
                    {(item as any).saves != null && (
                      <StatChip icon="bookmark" value={(item as any).saves} colors={colors} />
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function StatChip({
  icon,
  value,
  colors,
}: {
  icon: string;
  value?: number | null;
  colors: ReturnType<typeof useColors>;
}) {
  if (value == null) return null;
  return (
    <View style={styles.stat}>
      <Feather name={icon as any} size={11} color={colors.mutedForeground} />
      <Text style={[styles.statText, { color: colors.mutedForeground }]}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)}
      </Text>
    </View>
  );
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
  headerTitle: { fontSize: 22, fontWeight: "700", letterSpacing: 1 },
  headerSub: { fontSize: 12 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptyHint: { fontSize: 13 },
  card: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardRow: { flexDirection: "row" },
  thumb: {
    width: 80,
    aspectRatio: 9 / 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  caption: { fontSize: 13, fontWeight: "500", flex: 1, lineHeight: 18 },
  date: { fontSize: 11, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11 },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
});
