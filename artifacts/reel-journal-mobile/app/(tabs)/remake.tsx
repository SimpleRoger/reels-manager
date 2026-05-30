import { useListReferences } from "@workspace/api-client-react";
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

export default function RemakeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useListReferences();

  const refs = [...(data?.references ?? [])].sort(
    (a, b) => ((b as any).viewCount ?? -1) - ((a as any).viewCount ?? -1)
  );

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
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
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
                    <Feather
                      name="play"
                      size={24}
                      color={colors.mutedForeground}
                    />
                  </View>
                )}
                {(item as any).viewCount == null && (
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
                  {(item as any).viewCount != null && (
                    <View style={styles.stat}>
                      <Feather
                        name="eye"
                        size={10}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.statText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {formatNum((item as any).viewCount)}
                      </Text>
                    </View>
                  )}
                  {item.likeCount != null && (
                    <View style={styles.stat}>
                      <Feather
                        name="heart"
                        size={10}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.statText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {formatNum(item.likeCount)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptyHint: { fontSize: 13 },
  row: { gap: 8, marginBottom: 8 },
  card: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbContainer: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 9 / 16 },
  spinnerOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  cardInfo: { padding: 8 },
  account: { fontSize: 11, fontWeight: "600", marginBottom: 3 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 10 },
});
