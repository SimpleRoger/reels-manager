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
  AlertTriangle, Search, Loader2, ExternalLink, Play, Check, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
                {sortedResults.map((result) => {
                  const saved = savedIds.has(result.shortcode);
                  return (
                    <div
                      key={result.shortcode}
                      className="bg-background border border-border rounded-xl overflow-hidden flex flex-col hover-elevate group"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[9/16] max-h-48 bg-muted overflow-hidden shrink-0">
                        {result.thumbnailUrl ? (
                          <img
                            src={result.thumbnailUrl}
                            alt={`@${result.accountName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                            <Play className="w-8 h-8" />
                          </div>
                        )}
                        {/* Stats overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ViralFinder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [view, setView] = useState<"reach" | "likes" | "comments">("reach");
  const [tab, setTab] = useState<"hashtags" | "search">("search");

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
      <div className="flex gap-1 bg-card border border-card-border rounded-lg p-1 w-fit">
        {([
          { id: "search", label: "Search Reels", icon: Search },
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
