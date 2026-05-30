import {
  useGetDashboardSummary,
  useGetInstagramStatus,
  useSyncReels,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [syncing, setSyncing] = useState(false);

  const { data: summary, isLoading, refetch } = useGetDashboardSummary();
  const { data: status } = useGetInstagramStatus();
  const syncMutation = useSyncReels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleSync() {
    if (syncing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await syncMutation.mutateAsync();
      await refetch();
    } finally {
      setSyncing(false);
    }
  }

  const avg = summary?.averages;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Profile
        </Text>
        <Pressable
          onPress={handleSync}
          style={[
            styles.syncBtn,
            { backgroundColor: colors.primary, opacity: syncing ? 0.7 : 1 },
          ]}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="refresh-cw" size={14} color={colors.primaryForeground} />
          )}
          <Text style={[styles.syncText, { color: colors.primaryForeground }]}>
            Sync
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80,
          padding: 16,
        }}
      >
        <View
          style={[
            styles.accountCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: colors.primary + "22" },
            ]}
          >
            <Feather name="instagram" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.username, { color: colors.foreground }]}>
              {status?.username ? `@${status.username}` : "Not connected"}
            </Text>
            <View style={styles.connRow}>
              <View
                style={[
                  styles.connDot,
                  {
                    backgroundColor: status?.connected
                      ? colors.overperforming
                      : colors.destructive,
                  },
                ]}
              />
              <Text style={[styles.connText, { color: colors.mutedForeground }]}>
                {status?.connected ? "Connected" : "Disconnected"}
              </Text>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Reels"
                value={String(summary?.totalReels ?? 0)}
                icon="film"
                colors={colors}
              />
              <StatCard
                label="Avg Likes"
                value={formatNum(avg?.avgLikes)}
                icon="heart"
                colors={colors}
              />
              <StatCard
                label="Avg Comments"
                value={formatNum(avg?.avgComments)}
                icon="message-circle"
                colors={colors}
              />
              <StatCard
                label="Avg Reach"
                value={formatNum(avg?.avgReach)}
                icon="eye"
                colors={colors}
              />
              {avg?.avgSaves != null && (
                <StatCard
                  label="Avg Saves"
                  value={formatNum(avg.avgSaves)}
                  icon="bookmark"
                  colors={colors}
                />
              )}
              {avg?.avgShares != null && (
                <StatCard
                  label="Avg Shares"
                  value={formatNum(avg.avgShares)}
                  icon="share-2"
                  colors={colors}
                />
              )}
            </View>

            {status?.lastSynced && (
              <Text
                style={[styles.lastSynced, { color: colors.mutedForeground }]}
              >
                Last synced{" "}
                {new Date(status.lastSynced).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  colors,
}: {
  label: string;
  value: string;
  icon: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name={icon as any} size={16} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function formatNum(v?: number | null): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "700" },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  syncText: { fontSize: 13, fontWeight: "600" },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { fontSize: 17, fontWeight: "600" },
  connRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  connDot: { width: 7, height: 7, borderRadius: 3.5 },
  connText: { fontSize: 12 },
  loadingBox: { height: 200, alignItems: "center", justifyContent: "center" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: "47%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statValue: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12 },
  lastSynced: { fontSize: 12, textAlign: "center" },
});
