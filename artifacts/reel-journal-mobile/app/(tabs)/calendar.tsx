import { useListCalendarPosts } from "@workspace/api-client-react";
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
import { useColors } from "@/hooks/useColors";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const SCHEDULE_LABEL: Record<number, string> = {
  1: "Main Reel",
  3: "Main Reel",
  5: "Trial Reel",
};

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const start = new Date(year, month, 1).toISOString().split("T")[0];
  const end = new Date(year, month + 1, 0).toISOString().split("T")[0];

  const { data, isLoading } = useListCalendarPosts({ start, end });
  const posts = data?.posts ?? [];

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const postsByDay: Record<number, typeof posts> = {};
  for (const post of posts) {
    const d = new Date((post as any).scheduledDate ?? (post as any).date ?? "");
    const day = d.getDate();
    if (!postsByDay[day]) postsByDay[day] = [];
    postsByDay[day].push(post);
  }

  const todayDay =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : null;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }

  const selectedPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : posts;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={prevMonth} style={styles.navBtn}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.foreground }]}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable onPress={nextMonth} style={styles.navBtn}>
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80,
        }}
      >
        <View
          style={[
            styles.grid,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.dayNames}>
            {DAYS.map((d) => (
              <Text
                key={d}
                style={[styles.dayName, { color: colors.mutedForeground }]}
              >
                {d}
              </Text>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.cells}>
              {cells.map((day, i) => {
                if (!day)
                  return <View key={`e${i}`} style={styles.cell} />;
                const hasPosts = !!postsByDay[day]?.length;
                const isToday = day === todayDay;
                const isSelected = day === selectedDay;
                const dow = new Date(year, month, day).getDay();
                const schedLabel = SCHEDULE_LABEL[dow];
                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.cell,
                      isSelected && {
                        backgroundColor: colors.primary + "22",
                        borderRadius: 8,
                      },
                    ]}
                    onPress={() =>
                      setSelectedDay(day === selectedDay ? null : day)
                    }
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        isToday && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          {
                            color: isToday
                              ? colors.primaryForeground
                              : colors.foreground,
                            fontWeight: isToday ? "700" : "400",
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                    {hasPosts ? (
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    ) : schedLabel ? (
                      <View
                        style={[styles.dot, { backgroundColor: colors.border }]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.listSection}>
          <Text style={[styles.listTitle, { color: colors.mutedForeground }]}>
            {selectedDay
              ? `${MONTHS[month]} ${selectedDay}`
              : "This month"}
          </Text>

          {selectedPosts.length === 0 ? (
            <View style={styles.emptyRow}>
              <Feather name="calendar" size={20} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nothing scheduled
              </Text>
            </View>
          ) : (
            selectedPosts.map((post) => (
              <View
                key={post.id}
                style={[
                  styles.postCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[styles.postDot, { backgroundColor: colors.primary }]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.postTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {(post as any).title ?? (post as any).type ?? "Post"}
                  </Text>
                  <Text
                    style={[
                      styles.postDate,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {new Date(
                      (post as any).scheduledDate ?? (post as any).date ?? ""
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                {(post as any).completed && (
                  <Feather
                    name="check-circle"
                    size={16}
                    color={colors.overperforming}
                  />
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: "700" },
  grid: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  dayNames: { flexDirection: "row", marginBottom: 4 },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loadingRow: { height: 200, alignItems: "center", justifyContent: "center" },
  cells: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontSize: 13 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  listSection: { padding: 16 },
  listTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
    justifyContent: "center",
  },
  emptyText: { fontSize: 14 },
  postCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  postDot: { width: 8, height: 8, borderRadius: 4 },
  postTitle: { fontSize: 14, fontWeight: "500" },
  postDate: { fontSize: 12, marginTop: 2 },
});
