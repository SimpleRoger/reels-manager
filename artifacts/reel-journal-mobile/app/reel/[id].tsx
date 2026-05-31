import { useListReels } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const fmt = (n?: number | null) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Feather name={icon as any} size={12} color="#F49325" />
      <Text style={styles.pillText}>{value}</Text>
    </View>
  );
}

function ReelSlide({ reel, isActive }: { reel: any; isActive: boolean }) {
  const insets = useSafeAreaInsets();
  const mediaUrl = reel.mediaUrl as string | undefined | null;
  const hasVideo = !!mediaUrl;

  const player = useVideoPlayer(hasVideo ? { uri: mediaUrl! } : null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!hasVideo) return;
    try {
      if (isActive) {
        player.play();
      } else {
        player.pause();
      }
    } catch (_) {}
  }, [isActive, hasVideo]);

  const status = reel.status as string | undefined;
  const statusColor =
    status === "overperforming"
      ? "#4ADE80"
      : status === "underperforming"
      ? "#EF4343"
      : "#8A90A8";

  return (
    <View style={styles.slide}>
      {/* Full-screen video or thumbnail */}
      {hasVideo ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : reel.thumbnailUrl ? (
        <Image
          source={{ uri: reel.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noMedia]}>
          <Feather name="film" size={48} color="#444" />
        </View>
      )}

      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)"]}
        style={[
          styles.gradient,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 96) },
        ]}
      >
        {status && (
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        )}

        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={4}>
            {reel.caption}
          </Text>
        ) : null}

        {reel.postedAt ? (
          <Text style={styles.date}>
            {new Date(reel.postedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        ) : null}

        <View style={styles.statsRow}>
          <StatPill icon="heart" value={fmt(reel.likeCount)} />
          <StatPill icon="message-circle" value={fmt(reel.commentsCount)} />
          {reel.reach != null && <StatPill icon="eye" value={fmt(reel.reach)} />}
          {reel.saves != null && (
            <StatPill icon="bookmark" value={fmt(reel.saves)} />
          )}
          {reel.shares != null && (
            <StatPill icon="share-2" value={fmt(reel.shares)} />
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

export default function ReelFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [didScroll, setDidScroll] = useState(false);

  const { data } = useListReels({
    sortBy: "likeCount",
    sortOrder: "desc",
    limit: 50,
  });
  const reels = data?.reels ?? [];

  const initialIndex = useMemo(() => {
    const idx = reels.findIndex((r) => String(r.id) === String(id));
    return idx >= 0 ? idx : 0;
  }, [reels, id]);

  // Jump to the tapped reel once the list is populated
  useEffect(() => {
    if (reels.length > 0 && !didScroll) {
      setActiveIndex(initialIndex);
      setDidScroll(true);
      if (initialIndex > 0) {
        listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }
    }
  }, [reels.length, initialIndex, didScroll]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    },
    []
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 60 }),
    []
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <ReelSlide reel={item} isActive={index === activeIndex} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        maxToRenderPerBatch={3}
        initialNumToRender={1}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />

      {/* Back button */}
      <Pressable
        style={[styles.backBtn, { top: topPad + 8 }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={20} color="#fff" />
      </Pressable>

      {/* Counter */}
      {reels.length > 0 && (
        <View style={[styles.counter, { top: topPad + 14 }]}>
          <Text style={styles.counterText}>
            {activeIndex + 1} / {reels.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },
  noMedia: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 100,
    paddingHorizontal: 16,
    gap: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  caption: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  date: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
});
