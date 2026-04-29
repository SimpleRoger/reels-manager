import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCreateReference, getListReferencesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import {
  Hash, TrendingUp, Eye, Heart, Sparkles, Wand2, BookmarkPlus, MessageCircle, Lightbulb,
  AlertTriangle, Search, Loader2, ExternalLink, Play, Check, Send, Flame, RefreshCw, Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InlinePlayer } from "@/components/inline-player";
import { VideoThumb } from "@/components/video-thumb";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface HashtagStat {
  tag: string;
  count: number;
  avgReach: number;
  avgLikes: number;
  avgComments: number;
  overperformingCount: number;
}

interface AISuggestions {
  niche: string;
  strategy: string;
  newHashtags: string;
  hashtagsToDropOrReduce: string;
}

interface SearchReelResult {
  url: string;
  shortcode: string;
  accountName: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  shareCount?: number | null;
  takenAt?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AiBlock({ label, text, icon: Icon, numbered = false }: { label: string; text: string; icon: React.ElementType; numbered?: boolean }) {
  const lines = text.split(/\\n|\n/).map(l => l.trim()).filter(Boolean);
  return (
    <div>
      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <Icon className="w-3 h-3 text-primary" /> {label}
      </h4>
      <div className="text-sm bg-background p-3 rounded-md border space-y-1">
        {lines.length > 1 ? (
          <ul className="space-y-1">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                {numbered ? <span className="text-primary font-mono shrink-0">{i + 1}.</span> : <span className="text-primary shrink-0 mt-0.5">›</span>}
                <span>{l}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────────────────

type SortKey = "comments" | "likes" | "views" | "shares";

function SearchTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("comments");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [playingShortcode, setPlayingShortcode] = useState<string | null>(null);

  const createRefMutation = useCreateReference();

  const searchMutation = useMutation({
    mutationFn: async (hashtag: string) => {
      const resp = await fetch(`${BASE}/api/reel-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtag, limit: 30 }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? "Search failed");
      }
      return resp.json() as Promise<{ results: SearchReelResult[]; hashtag: string }>;
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const sortedResults = [...(searchMutation.data?.results ?? [])].sort((a, b) => {
    if (sort === "likes") return (b.likeCount ?? 0) - (a.likeCount ?? 0);
    if (sort === "views") return (b.viewCount ?? 0) - (a.viewCount ?? 0);
    if (sort === "shares") return (b.shareCount ?? 0) - (a.shareCount ?? 0);
    return (b.commentsCount ?? 0) - (a.commentsCount ?? 0);
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query.trim());
  }

  function handleSave(result: SearchReelResult) {
    createRefMutation.mutate(
      {
        data: {
          url: result.url,
          accountName: result.accountName,
          caption: result.caption ?? null,
          thumbnailUrl: result.thumbnailUrl ?? null,
          mediaUrl: result.videoUrl ?? null,
          viewCount: result.viewCount ?? null,
          likeCount: result.likeCount ?? null,
          commentsCount: result.commentsCount ?? null,
        },
      },
      {
        onSuccess: () => {
          setSavedIds((prev) => new Set([...prev, result.shortcode]));
          toast({ title: `@${result.accountName}'s reel saved to Remake List` });
          queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" /> Reel Search
          </CardTitle>
          <CardDescription>
            Search any keyword or topic — finds reels posted to that keyword, sorted by engagement. Save any reel directly to your Remake List.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">#</span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/^#/, ""))}
                placeholder="luxurycars, streetwear, carsofinstagram..."
                className="pl-7 font-mono text-sm bg-background"
                disabled={searchMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={!query.trim() || searchMutation.isPending}
              className="font-mono uppercase tracking-wider text-xs shrink-0"
            >
              {searchMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Search</>
              )}
            </Button>
          </form>

          {searchMutation.isPending && (
            <p className="text-xs text-muted-foreground font-mono mt-3">
              Searching Instagram for "{query}" — this usually takes 30–90 seconds...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {(searchMutation.data || searchMutation.isPending) && (
        <Card className="bg-card border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">
                {searchMutation.data
                  ? `${searchMutation.data.results.length} reels for #${searchMutation.data.hashtag}`
                  : "Loading..."}
              </CardTitle>
            </div>
            {searchMutation.data && (
              <div className="flex gap-1 bg-background rounded-md p-1 border text-xs font-mono">
                {(["views", "likes", "shares", "comments"] as SortKey[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setSort(v)}
                    className={`px-3 py-1 rounded uppercase tracking-wider transition-colors ${
                      sort === v ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {searchMutation.isPending ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
              </div>
            ) : sortedResults.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No reels found for this keyword.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedResults.map((result, idx) => {
                  const saved = savedIds.has(result.shortcode);
                  const isPlaying = playingShortcode === result.shortcode;
                  return (
                    <div
                      key={`${result.shortcode}-${idx}`}
                      className="bg-background border border-border rounded-xl overflow-hidden flex flex-col hover-elevate group"
                    >
                      {/* Thumbnail / Player */}
                      <div
                        className="relative aspect-[9/16] bg-zinc-900 overflow-hidden shrink-0 cursor-pointer"
                        onClick={() => setPlayingShortcode(isPlaying ? null : result.shortcode)}
                      >
                        {isPlaying ? (
                          <InlinePlayer
                            mediaUrl={result.videoUrl ?? null}
                            thumbnailUrl={result.thumbnailUrl ?? null}
                            instagramUrl={result.url}
                            onClose={() => setPlayingShortcode(null)}
                            className="absolute inset-0"
                          />
                        ) : (
                          <>
                            {result.thumbnailUrl ? (
                              <img
                                src={result.thumbnailUrl}
                                alt={`@${result.accountName}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <VideoThumb videoUrl={result.videoUrl} className="transition-transform duration-500 group-hover:scale-105" />
                            )}
                            {/* Hover play button */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl">
                                <Play className="w-6 h-6 text-black fill-black ml-1" />
                              </div>
                            </div>
                          </>
                        )}
                        {/* Stats overlay — always visible */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 pointer-events-none">
                          <div className="flex items-center gap-3 text-[11px] font-mono text-white/90">
                            {result.viewCount != null && (
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {formatNumber(result.viewCount)}
                              </span>
                            )}
                            {result.likeCount != null && (
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {formatNumber(result.likeCount)}
                              </span>
                            )}
                            {result.shareCount != null && (
                              <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                {formatNumber(result.shareCount)}
                              </span>
                            )}
                            {result.commentsCount != null && (
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {formatNumber(result.commentsCount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-mono text-xs hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            @{result.accountName}
                          </a>
                        </div>

                        {result.caption && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {result.caption}
                          </p>
                        )}

                        <Button
                          size="sm"
                          variant={saved ? "outline" : "default"}
                          className="mt-auto font-mono uppercase tracking-wider text-[10px] h-7 w-full"
                          onClick={() => !saved && handleSave(result)}
                          disabled={saved || createRefMutation.isPending}
                        >
                          {saved ? (
                            <><Check className="w-3 h-3 mr-1" /> Saved</>
                          ) : (
                            <><BookmarkPlus className="w-3 h-3 mr-1" /> Save to Remake List</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Trending Tab ─────────────────────────────────────────────────────────────

interface TrendingReel {
  url: string | null;
  shortcode: string;
  accountName: string;
  section: string | null;
  topic: string | null;
  type: string | null;
  isVideo: boolean;
  caption: string | null;
  date: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentsCount: number | null;
}

type TrendSortKey = "views" | "likes" | "comments";

function TrendingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [results, setResults] = useState<TrendingReel[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [sort, setSort] = useState<TrendSortKey>("views");
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const [playingShortcode, setPlayingShortcode] = useState<string | null>(null);

  const fetchMutation = useMutation({
    mutationFn: async () => {
      // Step 1: kick off the run and get a runId immediately
      const startResp = await fetch(`${BASE}/api/trending-reels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      if (!startResp.ok) {
        const err = await startResp.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? "Failed to start trending fetch");
      }
      const { runId } = await startResp.json() as { runId: string };

      // Step 2: poll status every 5 s until done (max 5 min)
      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        const poll = await fetch(`${BASE}/api/trending-reels/status/${runId}`);
        if (!poll.ok) {
          const err = await poll.json().catch(() => ({})) as { error?: string };
          throw new Error(err?.error ?? "Trending fetch failed");
        }
        const body = await poll.json() as { status: string; results?: TrendingReel[] };
        if (body.status === "done") return { results: body.results ?? [] };
        // status === "running" → loop again
      }
      throw new Error("Trending fetch timed out");
    },
    onSuccess: (data) => {
      setResults(data.results);
      setHasFetched(true);
      setFailedThumbs(new Set());
      setSectionFilter(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createRefMutation = useCreateReference();

  function handleSave(r: TrendingReel) {
    if (!r.url) return;
    createRefMutation.mutate(
      {
        data: {
          url: r.url,
          accountName: r.accountName,
          caption: r.caption ?? null,
          thumbnailUrl: r.thumbnailUrl ?? null,
          mediaUrl: r.videoUrl ?? null,
          viewCount: r.viewCount ?? null,
          likeCount: r.likeCount ?? null,
          commentsCount: r.commentsCount ?? null,
        },
      },
      {
        onSuccess: () => {
          setSavedIds((prev) => new Set([...prev, r.shortcode]));
          toast({ title: `@${r.accountName}'s reel saved to Remake List` });
          queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  // Unique sections for filter pills
  const sections = Array.from(new Set(results.map((r) => r.section).filter(Boolean))) as string[];

  const filtered = sectionFilter ? results.filter((r) => r.section === sectionFilter) : results;
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "likes") return (b.likeCount ?? 0) - (a.likeCount ?? 0);
    if (sort === "comments") return (b.commentsCount ?? 0) - (a.commentsCount ?? 0);
    return (b.viewCount ?? 0) - (a.viewCount ?? 0);
  });

  return (
    <div className="space-y-4">
      {/* Fetch control card */}
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" /> Instagram Trending Now
          </CardTitle>
          <CardDescription>
            Pulls the current Instagram Explore feed — reels and posts trending across all niches right now. Takes 30–90 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => fetchMutation.mutate()}
              disabled={fetchMutation.isPending}
              className="font-mono uppercase tracking-wider text-xs"
            >
              {fetchMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching...</>
              ) : hasFetched ? (
                <><RefreshCw className="w-4 h-4 mr-2" /> Refresh Trending</>
              ) : (
                <><Flame className="w-4 h-4 mr-2" /> Fetch Trending</>
              )}
            </Button>
            {fetchMutation.isPending && (
              <p className="text-xs text-muted-foreground font-mono">
                Scraping Instagram Explore — this usually takes 30–90 seconds...
              </p>
            )}
            {hasFetched && !fetchMutation.isPending && (
              <p className="text-xs text-muted-foreground font-mono">
                {results.length} trending posts fetched
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(hasFetched || fetchMutation.isPending) && (
        <Card className="bg-card border-card-border">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Section filter pills */}
              {sections.length > 0 && (
                <>
                  <button
                    onClick={() => setSectionFilter(null)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                      !sectionFilter
                        ? "bg-primary text-black border-primary"
                        : "text-muted-foreground border-card-border hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {sections.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSectionFilter(sectionFilter === s ? null : s)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                        sectionFilter === s
                          ? "bg-primary text-black border-primary"
                          : "text-muted-foreground border-card-border hover:text-foreground"
                      }`}
                    >
                      <Tag className="w-2.5 h-2.5" /> {s}
                    </button>
                  ))}
                </>
              )}
            </div>
            {/* Sort buttons */}
            {results.length > 0 && (
              <div className="flex gap-1 bg-background rounded-md p-1 border text-xs font-mono shrink-0">
                {(["views", "likes", "comments"] as TrendSortKey[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setSort(v)}
                    className={`px-3 py-1 rounded uppercase tracking-wider transition-colors ${
                      sort === v ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {fetchMutation.isPending && results.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-[9/16] w-full rounded-xl" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                <Flame className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No results for this filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sorted.map((result, idx) => {
                  const saved = savedIds.has(result.shortcode);
                  const thumbFailed = result.thumbnailUrl ? failedThumbs.has(result.thumbnailUrl) : true;
                  return (
                    <div key={result.shortcode || idx} className="flex flex-col rounded-xl border border-card-border overflow-hidden bg-background hover-elevate group">
                      {/* Thumbnail / Player */}
                      <div
                        className="relative aspect-[9/16] bg-zinc-900 cursor-pointer"
                        onClick={() => setPlayingShortcode(playingShortcode === result.shortcode ? null : result.shortcode)}
                      >
                        {playingShortcode === result.shortcode ? (
                          <InlinePlayer
                            mediaUrl={result.videoUrl ?? null}
                            thumbnailUrl={result.thumbnailUrl ?? null}
                            instagramUrl={result.url ?? ""}
                            onClose={() => setPlayingShortcode(null)}
                            className="absolute inset-0"
                          />
                        ) : (
                          <>
                            {result.thumbnailUrl && !thumbFailed ? (
                              <img
                                key={result.thumbnailUrl}
                                src={result.thumbnailUrl}
                                alt={`@${result.accountName}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={() => setFailedThumbs((p) => new Set([...p, result.thumbnailUrl!]))}
                              />
                            ) : (
                              <VideoThumb videoUrl={result.videoUrl} className="transition-transform duration-500 group-hover:scale-105" />
                            )}
                            {/* Hover play button */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl">
                                <Play className="w-6 h-6 text-black fill-black ml-1" />
                              </div>
                            </div>
                          </>
                        )}

                        {/* Topic badge */}
                        {(result.topic || result.section) && (
                          <div className="absolute top-2 left-2 right-2 pointer-events-none">
                            <span className="inline-flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white/90 text-[10px] font-mono px-2 py-0.5 rounded-full max-w-full truncate">
                              <Tag className="w-2.5 h-2.5 shrink-0 text-primary" />
                              {result.topic ?? result.section}
                            </span>
                          </div>
                        )}

                        {/* Stats overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 pointer-events-none">
                          <div className="flex items-center gap-3 text-[11px] font-mono text-white/90">
                            {result.viewCount != null && (
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {formatNumber(result.viewCount)}
                              </span>
                            )}
                            {result.likeCount != null && (
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {formatNumber(result.likeCount)}
                              </span>
                            )}
                            {result.commentsCount != null && (
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {formatNumber(result.commentsCount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={result.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-mono text-xs hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            @{result.accountName}
                          </a>
                          {result.section && result.topic && (
                            <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 truncate max-w-[90px]">
                              {result.section}
                            </span>
                          )}
                        </div>

                        {result.caption && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {result.caption}
                          </p>
                        )}

                        <Button
                          size="sm"
                          variant={saved ? "outline" : "default"}
                          className="mt-auto font-mono uppercase tracking-wider text-[10px] h-7 w-full"
                          onClick={() => !saved && handleSave(result)}
                          disabled={saved || createRefMutation.isPending}
                        >
                          {saved ? (
                            <><Check className="w-3 h-3 mr-1" /> Saved</>
                          ) : (
                            <><BookmarkPlus className="w-3 h-3 mr-1" /> Save to Remake List</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ViralFinder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [view, setView] = useState<"reach" | "likes" | "comments">("reach");
  const [tab, setTab] = useState<"hashtags" | "search" | "trending">("search");

  const { data, isLoading } = useQuery<{ hashtags: HashtagStat[] }>({
    queryKey: ["viral-finder-hashtags"],
    queryFn: async () => {
      const resp = await fetch(`${BASE}/api/viral-finder/hashtags`);
      if (!resp.ok) throw new Error("Failed to load hashtag data");
      return resp.json();
    },
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${BASE}/api/viral-finder/ai-suggestions`, { method: "POST" });
      if (!resp.ok) throw new Error("AI request failed");
      return resp.json() as Promise<AISuggestions>;
    },
    onSuccess: (d) => setAiSuggestions(d),
    onError: () => toast({ title: "Failed to generate suggestions", variant: "destructive" }),
  });

  const createRefMutation = useCreateReference();

  function saveHashtagAsRef(tag: string) {
    createRefMutation.mutate({
      data: { url: `https://www.instagram.com/explore/tags/${tag.replace("#", "")}/`, caption: `Hashtag to study: ${tag}` }
    }, {
      onSuccess: () => {
        toast({ title: `${tag} saved to Remake List` });
        queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  }

  const sorted = [...(data?.hashtags ?? [])].sort((a, b) => {
    if (view === "likes") return b.avgLikes - a.avgLikes;
    if (view === "comments") return b.avgComments - a.avgComments;
    return b.avgReach - a.avgReach;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Viral Finder</h1>
        <p className="text-muted-foreground text-sm">Search reels by hashtag and study what's getting engagement.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-card border border-card-border rounded-lg p-1 w-fit flex-wrap">
        {([
          { id: "search", label: "Search Reels", icon: Search },
          { id: "trending", label: "Trending Now", icon: Flame },
          { id: "hashtags", label: "My Hashtags", icon: Hash },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono uppercase tracking-wider transition-colors ${
              tab === id
                ? "bg-primary text-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Search tab */}
      {tab === "search" && <SearchTab />}

      {/* Trending tab */}
      {tab === "trending" && <TrendingTab />}

      {/* Hashtag analytics tab */}
      {tab === "hashtags" && (
        <>
          <Card className="bg-card border-card-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-primary" /> Your Hashtag Performance
                </CardTitle>
                <CardDescription>Every hashtag from your captions, ranked by average metrics across posts that used it</CardDescription>
              </div>
              <div className="flex gap-1 bg-background rounded-md p-1 border text-xs font-mono">
                {(["reach", "likes", "comments"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1 rounded uppercase tracking-wider transition-colors ${
                      view === v ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : sorted.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
                  <Hash className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hashtags found. Sync your reels first — hashtags are extracted from your captions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {sorted.map((h) => (
                    <Card
                      key={h.tag}
                      className={`bg-background border group hover-elevate cursor-pointer transition-colors ${
                        h.overperformingCount > 0 ? "border-primary/30" : ""
                      }`}
                    >
                      <CardContent className="p-3 flex flex-col gap-2 h-full">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-primary font-mono text-sm font-semibold break-all leading-snug">{h.tag}</span>
                          {h.overperformingCount > 0 && (
                            <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              🔥 {h.overperformingCount}×
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3 text-primary/70" />
                            <span>{formatNumber(h.avgReach)} avg reach</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-primary/70" />
                            <span>{formatNumber(h.avgLikes)} avg likes</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground/60">
                            <Hash className="w-3 h-3" />
                            <span>used in {h.count} reel{h.count !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => saveHashtagAsRef(h.tag)}
                          className="mt-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <BookmarkPlus className="w-3 h-3" /> Save to list
                        </button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> AI Hashtag Strategy
                </CardTitle>
                <CardDescription>New hashtags to try + which ones to retire, based on your actual performance data</CardDescription>
              </div>
              <Button
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
                className="font-mono uppercase tracking-wider text-xs"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {aiMutation.isPending ? "Analysing..." : aiSuggestions ? "Regenerate" : "Analyse"}
              </Button>
            </CardHeader>
            <CardContent>
              {aiMutation.isPending ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : aiSuggestions ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> Niche Assessment
                    </h4>
                    <p className="text-sm leading-relaxed bg-background p-3 rounded-md border">{aiSuggestions.niche}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> Strategy
                    </h4>
                    <p className="text-sm leading-relaxed bg-background p-3 rounded-md border">{aiSuggestions.strategy}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AiBlock label="New Hashtags to Try" text={aiSuggestions.newHashtags} icon={Lightbulb} />
                    <AiBlock label="Hashtags to Drop or Reduce" text={aiSuggestions.hashtagsToDropOrReduce} icon={AlertTriangle} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="w-12 h-12 text-muted mb-4" />
                  <p className="text-muted-foreground max-w-sm">
                    Click Analyse to get new hashtag ideas and retirement suggestions based on what's actually working in your reels.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
