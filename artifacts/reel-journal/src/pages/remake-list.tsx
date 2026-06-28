import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import {
  useListReferences,
  getListReferencesQueryKey,
  useCreateReference,
  useUpdateReference,
  useDeleteReference,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trash2, ExternalLink, Bookmark, Plus, Link2, Loader2,
  X, Play, Eye, Heart, MessageCircle, FileText, Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InlinePlayer } from "@/components/inline-player";
import { VideoThumb } from "@/components/video-thumb";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_TAGS = ["Music", "Content", "Health"] as const;

const TAG_COLORS: Record<string, string> = {
  music:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  content: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  health:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function tagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Ref = {
  id: number;
  url: string;
  accountName?: string | null;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  whyItsgood?: string | null;
  whatToChange?: string | null;
  howToRemake?: string | null;
  tags?: string[] | null;
};

// ─── Tag Chip ─────────────────────────────────────────────────────────────────

function TagChip({
  tag,
  onRemove,
  small = false,
}: {
  tag: string;
  onRemove?: () => void;
  small?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 border rounded-full font-mono ${
        small ? "text-[8px] px-1.5 py-0 leading-4" : "text-[10px] px-2 py-0.5"
      } ${tagColor(tag)}`}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100">
          <X className="w-2 h-2" />
        </button>
      )}
    </span>
  );
}

// ─── Tag Picker ───────────────────────────────────────────────────────────────

function TagPicker({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [customInput, setCustomInput] = useState("");

  function toggle(tag: string) {
    const lc = tag.toLowerCase();
    const norm = tags.map((t) => t.toLowerCase());
    if (norm.includes(lc)) {
      onChange(tags.filter((t) => t.toLowerCase() !== lc));
    } else {
      onChange([...tags, tag]);
    }
  }

  function addCustom() {
    const val = customInput.trim();
    if (!val) return;
    const norm = tags.map((t) => t.toLowerCase());
    if (!norm.includes(val.toLowerCase())) {
      onChange([...tags, val]);
    }
    setCustomInput("");
  }

  const tagLower = tags.map((t) => t.toLowerCase());

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Categories
      </label>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_TAGS.map((t) => {
          const active = tagLower.includes(t.toLowerCase());
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all ${
                active
                  ? `${tagColor(t)} border-current`
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Custom tag input */}
      <div className="flex gap-1.5">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Custom tag…"
          className="h-7 text-xs bg-background font-mono"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="h-7 px-2 text-xs"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Applied tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <TagChip
              key={t}
              tag={t}
              onRemove={() => onChange(tags.filter((x) => x !== t))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes Modal ──────────────────────────────────────────────────────────────

function NotesModal({
  reference: r,
  onClose,
  onSave,
  onDelete,
}: {
  reference: Ref;
  onClose: () => void;
  onSave: (
    id: number,
    data: { whyItsgood: string; whatToChange: string; howToRemake: string; tags: string[] }
  ) => void;
  onDelete: (id: number) => void;
}) {
  const [form, setForm] = useState({
    whyItsgood: r.whyItsgood ?? "",
    whatToChange: r.whatToChange ?? "",
    howToRemake: r.howToRemake ?? "",
  });
  const [tags, setTags] = useState<string[]>(r.tags ?? []);
  const [playing, setPlaying] = useState(true);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Video side ── */}
        <div className="relative bg-black sm:w-[280px] shrink-0 aspect-[9/16] sm:aspect-auto sm:h-auto">
          <div className="absolute inset-0">
            {playing ? (
              <InlinePlayer
                mediaUrl={r.mediaUrl}
                thumbnailUrl={r.thumbnailUrl}
                instagramUrl={r.url}
                onClose={() => setPlaying(false)}
                className="absolute inset-0"
              />
            ) : (
              <>
                <VideoThumb
                  thumbnailUrl={r.thumbnailUrl ?? null}
                  videoUrl={r.mediaUrl ?? null}
                  permalink={r.url}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <button
                    onClick={() => setPlaying(true)}
                    className="w-14 h-14 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center shadow-xl transition-transform hover:scale-110"
                  >
                    <Play className="w-6 h-6 text-black fill-black ml-1" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Notes side ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {r.accountName && (
                <span className="text-sm font-semibold truncate">@{r.accountName}</span>
              )}
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                {r.viewCount != null && (
                  <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{r.viewCount.toLocaleString()}</span>
                )}
                {r.likeCount != null && (
                  <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{r.likeCount.toLocaleString()}</span>
                )}
                {r.commentsCount != null && (
                  <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{r.commentsCount.toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title="Open original"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => { if (confirm("Remove from remake list?")) onDelete(r.id); }}
                className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 flex-1">
            {r.caption && (
              <p className="text-xs text-muted-foreground bg-background border rounded-lg p-3 line-clamp-3">
                {r.caption}
              </p>
            )}

            {/* Tag picker */}
            <TagPicker tags={tags} onChange={setTags} />

            {(
              [
                { key: "whyItsgood", label: "Why It's Good" },
                { key: "whatToChange", label: "What to Change" },
                { key: "howToRemake", label: "How to Remake" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {label}
                </label>
                <Textarea
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-16 text-xs resize-none bg-background"
                  placeholder={`Add notes about ${label.toLowerCase()}…`}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 shrink-0">
            <Button
              size="sm"
              onClick={() => { onSave(r.id, { ...form, tags }); onClose(); }}
              className="w-full font-mono uppercase text-[10px] tracking-wider"
            >
              Save Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RemakeList() {
  const { data, isLoading } = useListReferences({
    query: { queryKey: getListReferencesQueryKey() },
  });

  const createMutation = useCreateReference();
  const updateMutation = useUpdateReference();
  const deleteMutation = useDeleteReference();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const search = useSearch();
  const [, navigate] = useLocation();

  // Tag filter is driven by the URL ?tag= param so sidebar links work
  const tagFilter = new URLSearchParams(search).get("tag");
  const [sortBy, setSortBy] = useState<"recent" | "views" | "likes" | "comments">("recent");

  function setTagFilter(tag: string | null) {
    if (tag) {
      navigate(`/remake-list?tag=${encodeURIComponent(tag.toLowerCase())}`);
    } else {
      navigate("/remake-list");
    }
  }

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [notesId, setNotesId] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<"single" | "batch" | null>(null);
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [addingBatch, setAddingBatch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
  }

  // Poll while any reference is still missing stats (Apify still running)
  useEffect(() => {
    const hasPending = data?.references.some(
      (r) => r.viewCount == null && r.likeCount == null && r.commentsCount == null
    );
    if (!hasPending) return;
    const timer = setInterval(invalidate, 8_000);
    return () => clearInterval(timer);
  }, [data?.references]);

  // Auto-refresh stale CDN URLs once per browser session
  useEffect(() => {
    if (!data?.references.length) return;
    const SESSION_KEY = "remake_refreshed_at";
    const lastRefresh = Number(sessionStorage.getItem(SESSION_KEY) ?? 0);
    const hoursSinceRefresh = (Date.now() - lastRefresh) / 3_600_000;
    if (hoursSinceRefresh < 2) return;
    const anyStale = data.references.some((r) => {
      const ageHours = (Date.now() - new Date((r as any).updatedAt ?? 0).getTime()) / 3_600_000;
      return ageHours > 4;
    });
    if (!anyStale) return;
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    fetch("/api/references/refresh-all", { method: "POST" }).catch(() => {});
    const start = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - start > 180_000) { clearInterval(poll); return; }
      invalidate();
    }, 30_000);
    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data?.references.length]);

  function handleSave(
    id: number,
    values: { whyItsgood: string; whatToChange: string; howToRemake: string; tags: string[] }
  ) {
    updateMutation.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Notes saved" });
          invalidate();
        },
      }
    );
  }

  function handleDelete(id: number) {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Removed" });
          setNotesId(null);
          invalidate();
        },
      }
    );
  }

  function handleAddSingle() {
    const url = singleUrl.trim();
    if (!url) return;
    createMutation.mutate(
      { data: { url } },
      {
        onSuccess: () => {
          setSingleUrl("");
          setAddMode(null);
          toast({ title: "Reel added — scraping stats in background" });
          invalidate();
        },
      }
    );
  }

  async function handleAddBatch() {
    const urls = batchUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setAddingBatch(true);
    let added = 0, failed = 0;
    for (const url of urls) {
      try { await createMutation.mutateAsync({ data: { url } }); added++; }
      catch { failed++; }
    }
    setAddingBatch(false);
    setBatchUrls("");
    setAddMode(null);
    invalidate();
    toast({ title: `${added} reel${added !== 1 ? "s" : ""} added${failed > 0 ? `, ${failed} failed` : ""}` });
  }

  async function handleRefreshThumbnails() {
    setRefreshing(true);
    try {
      await fetch("/api/references/refresh-all", { method: "POST" });
      toast({ title: "Refreshing thumbnails in background — check back in ~2 min" });
      const start = Date.now();
      const poll = setInterval(() => {
        invalidate();
        if (Date.now() - start > 180_000) clearInterval(poll);
      }, 10_000);
    } catch {
      toast({ title: "Failed to start refresh", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  // Collect all unique tags across references (presets first, then custom)
  const allTags: string[] = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const refs = data?.references ?? [];

    // Presets first (only if they appear in data)
    for (const preset of PRESET_TAGS) {
      const lc = preset.toLowerCase();
      if (refs.some((r) => (r.tags ?? []).some((t) => t.toLowerCase() === lc))) {
        seen.add(lc);
        result.push(preset);
      }
    }
    // Then any custom tags
    for (const ref of refs) {
      for (const tag of ref.tags ?? []) {
        const lc = tag.toLowerCase();
        if (!seen.has(lc)) {
          seen.add(lc);
          result.push(tag);
        }
      }
    }
    return result;
  })();

  // Filtered + sorted references
  const references = [...(data?.references ?? [])]
    .filter((r) => {
      if (!tagFilter) return true;
      return (r.tags ?? []).some((t) => t.toLowerCase() === tagFilter.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === "recent") return new Date((b as any).createdAt ?? 0).getTime() - new Date((a as any).createdAt ?? 0).getTime();
      if (sortBy === "views")    return (b.viewCount ?? -1) - (a.viewCount ?? -1);
      if (sortBy === "likes")    return (b.likeCount ?? -1) - (a.likeCount ?? -1);
      if (sortBy === "comments") return (b.commentsCount ?? -1) - (a.commentsCount ?? -1);
      return 0;
    });

  const selectedRef = notesId != null
    ? data?.references.find((r) => r.id === notesId) as Ref | undefined
    : undefined;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Remake List</h1>
          <p className="text-muted-foreground text-sm">Save reels you want to study or remake.</p>
        </div>
        <div className="flex gap-2 flex-wrap sm:shrink-0 sm:justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            onClick={handleRefreshThumbnails}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Refresh Thumbs
          </Button>
          <Button
            size="sm"
            variant={addMode === "single" ? "secondary" : "outline"}
            className="font-mono text-xs uppercase tracking-wider"
            onClick={() => setAddMode(addMode === "single" ? null : "single")}
          >
            <Plus className="w-3 h-3 mr-1" /> Add Reel
          </Button>
          <Button
            size="sm"
            variant={addMode === "batch" ? "secondary" : "outline"}
            className="font-mono text-xs uppercase tracking-wider"
            onClick={() => setAddMode(addMode === "batch" ? null : "batch")}
          >
            <Link2 className="w-3 h-3 mr-1" /> Batch Import
          </Button>
        </div>
      </div>

      {/* Add forms */}
      {addMode === "single" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Paste a reel URL</p>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.instagram.com/reel/..."
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSingle()}
              className="font-mono text-xs bg-background"
              autoFocus
            />
            <Button onClick={handleAddSingle} disabled={!singleUrl.trim() || createMutation.isPending} size="sm">
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
            </Button>
            <Button onClick={() => { setAddMode(null); setSingleUrl(""); }} variant="ghost" size="sm">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {addMode === "batch" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Paste reel URLs — one per line</p>
          <Textarea
            placeholder={"https://www.instagram.com/reel/abc...\nhttps://www.instagram.com/reel/def..."}
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            className="font-mono text-xs bg-background min-h-[100px] resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setAddMode(null); setBatchUrls(""); }} variant="ghost" size="sm">Cancel</Button>
            <Button onClick={handleAddBatch} disabled={!batchUrls.trim() || addingBatch} size="sm">
              {addingBatch ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Adding...</> : <><Plus className="w-3 h-3 mr-1" />Add {batchUrls.trim().split("\n").filter(u => u.trim()).length} Reels</>}
            </Button>
          </div>
        </div>
      )}

      {/* Sort + filter row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Category filter tabs */}
        {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
          <button
            onClick={() => setTagFilter(null)}
            className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border transition-all ${
              tagFilter === null
                ? "bg-primary text-black border-primary"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            All ({data?.references.length ?? 0})
          </button>
          {allTags.map((tag) => {
            const count = (data?.references ?? []).filter((r) =>
              (r.tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase())
            ).length;
            const active = tagFilter?.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(active ? null : tag)}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border transition-all ${
                  active
                    ? `${tagColor(tag)} border-current`
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {tag} ({count})
              </button>
            );
          })}
        </div>
        )}

        {/* Sort controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
          {(["recent", "views", "likes", "comments"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border transition-all ${
                sortBy === opt
                  ? "bg-primary text-black border-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {opt === "recent" ? "Recent" : opt === "views" ? "Views" : opt === "likes" ? "Likes" : "Comments"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />)}
        </div>
      ) : references.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
          <Bookmark className="w-12 h-12 text-muted-foreground/50 mb-4" />
          {tagFilter ? (
            <>
              <p className="text-muted-foreground font-medium">No reels tagged "{tagFilter}"</p>
              <button onClick={() => setTagFilter(null)} className="text-xs text-primary mt-2 hover:underline">Show all</button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground font-medium">Your remake list is empty</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Paste a reel link above to get started</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {references.map((ref) => {
            const isPlaying = playingId === ref.id;
            const hasNotes = !!(ref as any).whyItsgood || !!(ref as any).whatToChange || !!(ref as any).howToRemake;
            const refTags: string[] = (ref as any).tags ?? [];

            return (
              <div
                key={ref.id}
                className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden group cursor-pointer"
                onClick={() => !isPlaying && setNotesId(ref.id)}
              >
                {isPlaying ? (
                  <InlinePlayer
                    mediaUrl={ref.mediaUrl}
                    thumbnailUrl={ref.thumbnailUrl}
                    instagramUrl={ref.url}
                    onClose={(e?: React.MouseEvent) => { e?.stopPropagation(); setPlayingId(null); }}
                    className="absolute inset-0"
                  />
                ) : (
                  <>
                    <VideoThumb
                      thumbnailUrl={ref.thumbnailUrl ?? null}
                      videoUrl={ref.mediaUrl ?? null}
                      permalink={ref.url}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Top-left indicators */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {ref.viewCount == null && ref.likeCount == null && (
                        <Loader2 className="w-3 h-3 animate-spin text-white/60" />
                      )}
                      {hasNotes && (
                        <div className="bg-primary/80 rounded-full p-1">
                          <FileText className="w-2.5 h-2.5 text-black" />
                        </div>
                      )}
                    </div>

                    {/* Tag chips — top right */}
                    {refTags.length > 0 && (
                      <div className="absolute top-2 right-2 flex flex-col gap-0.5 items-end">
                        {refTags.slice(0, 2).map((t) => (
                          <TagChip key={t} tag={t} small />
                        ))}
                        {refTags.length > 2 && (
                          <span className="text-[8px] font-mono text-white/50">+{refTags.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Play button on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlayingId(ref.id); }}
                        className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center shadow-xl transition-transform hover:scale-110"
                      >
                        <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                      </button>
                    </div>
                  </>
                )}

                {/* Stats — always visible */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 space-y-1 pointer-events-none">
                  {ref.accountName && (
                    <p className="text-[10px] font-semibold text-white/90 truncate">@{ref.accountName}</p>
                  )}
                  <div className="flex items-center gap-2 text-[9px] font-mono text-white/70">
                    {ref.viewCount != null && (
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{ref.viewCount.toLocaleString()}</span>
                    )}
                    {ref.likeCount != null && (
                      <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{ref.likeCount.toLocaleString()}</span>
                    )}
                    {ref.commentsCount != null && (
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{ref.commentsCount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes modal */}
      {selectedRef && (
        <NotesModal
          reference={selectedRef}
          onClose={() => setNotesId(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
