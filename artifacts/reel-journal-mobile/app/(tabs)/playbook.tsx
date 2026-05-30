import {
  useListPlaybookLessons,
  useCreatePlaybookLesson,
  useDeletePlaybookLesson,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  "hook", "format", "caption", "audio", "timing", "trend", "engagement", "other"
];

export default function PlaybookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("hook");

  const { data, isLoading, refetch } = useListPlaybookLessons();
  const createMutation = useCreatePlaybookLesson();
  const deleteMutation = useDeletePlaybookLesson();

  const lessons = data?.lessons ?? [];

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await createMutation.mutateAsync({
      data: { title: newTitle.trim(), body: newBody.trim(), category: newCategory },
    });
    setNewTitle("");
    setNewBody("");
    setNewCategory("hook");
    setAddVisible(false);
    refetch();
  }

  function handleDelete(id: number) {
    Alert.alert("Delete lesson?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteMutation.mutateAsync({ id });
          refetch();
        },
      },
    ]);
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
          Playbook
        </Text>
        <Pressable
          onPress={() => setAddVisible(true)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : lessons.length === 0 ? (
        <View style={styles.center}>
          <Feather name="book-open" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No lessons yet
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Tap + to add your first insight
          </Text>
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
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
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.catBadge,
                    { backgroundColor: colors.primary + "22" },
                  ]}
                >
                  <Text
                    style={[styles.catText, { color: colors.primary }]}
                  >
                    {(item as any).category ?? "lesson"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  hitSlop={8}
                >
                  <Feather
                    name="trash-2"
                    size={14}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
              <Text style={[styles.lessonTitle, { color: colors.foreground }]}>
                {item.title}
              </Text>
              {(item as any).body ? (
                <Text
                  style={[styles.lessonBody, { color: colors.mutedForeground }]}
                  numberOfLines={3}
                >
                  {(item as any).body}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}

      <Modal
        visible={addVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                New Lesson
              </Text>
              <Pressable onPress={() => setAddVisible(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewCategory(c)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor:
                        newCategory === c
                          ? colors.primary
                          : colors.muted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color:
                          newCategory === c
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              placeholder="Title"
              placeholderTextColor={colors.mutedForeground}
              value={newTitle}
              onChangeText={setNewTitle}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
            <TextInput
              placeholder="Notes (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={newBody}
              onChangeText={setNewBody}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.textArea,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />

            <Pressable
              onPress={handleAdd}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: newTitle.trim()
                    ? colors.primary
                    : colors.muted,
                },
              ]}
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primaryForeground}
                />
              ) : (
                <Text
                  style={[styles.saveBtnText, { color: colors.primaryForeground }]}
                >
                  Save Lesson
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptyHint: { fontSize: 13 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  catText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  lessonTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  lessonBody: { fontSize: 13, lineHeight: 19 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  catChipText: { fontSize: 12, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  saveBtn: {
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: "700" },
});
